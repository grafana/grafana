package login

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/keystone"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type keystoneAuther struct {
	server      string
	domainname  string
	roles       map[m.RoleType][]string
	admin_roles []string

	token        string
	project_list map[string][]string
}

func NewKeystoneAuthenticator(server, domainname string, global_admin_roles, admin_roles, editor_roles,
	read_editor_roles, viewer_roles []string) *keystoneAuther {
	roles := map[m.RoleType][]string{
		m.ROLE_ADMIN:            admin_roles,
		m.ROLE_EDITOR:           editor_roles,
		m.ROLE_READ_ONLY_EDITOR: read_editor_roles,
		m.ROLE_VIEWER:           viewer_roles,
	}
	return &keystoneAuther{server: server, domainname: domainname, roles: roles, admin_roles: global_admin_roles}
}

func (a *keystoneAuther) login(query *LoginUserQuery) error {

	// perform initial authentication
	if err := a.authenticate(query.Username, query.Password); err != nil {
		return err
	}

	if grafanaUser, err := a.getGrafanaUserFor(query.Username); err != nil {
		return err
	} else {
		// sync org roles
		if err := a.syncOrgRoles(query.Username, query.Password, grafanaUser); err != nil {
			return err
		}
		query.User = grafanaUser
		return nil
	}

}

func (a *keystoneAuther) authenticate(username, password string) error {
	auth := keystone.Auth_data{
		Server:   a.server,
		Username: username,
		Password: password,
		Domain:   a.domainname,
	}
	if err := keystone.AuthenticateUnscoped(&auth); err != nil {
		return err
	}
	a.token = auth.Token
	return nil
}

func (a *keystoneAuther) getGrafanaUserFor(username string) (*m.User, error) {
	// get user from grafana db
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: username}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err == m.ErrUserNotFound {
			return a.createGrafanaUser(username)
		} else {
			return nil, err
		}
	}

	return userQuery.Result, nil
}

func (a *keystoneAuther) createGrafanaUser(username string) (*m.User, error) {
	cmd := m.CreateUserCommand{
		Login: username,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return nil, err
	}

	return &cmd.Result, nil
}

func (a *keystoneAuther) updateGrafanaUserPermissions(userid int64, isAdmin bool) error {
	cmd := m.UpdateUserPermissionsCommand{
		UserId:         userid,
		IsGrafanaAdmin: isAdmin,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return err
	}

	return nil
}

func (a *keystoneAuther) getGrafanaOrgFor(orgname string) (*m.Org, error) {
	// get org from grafana db
	orgQuery := m.GetOrgByNameQuery{Name: orgname}
	if err := bus.Dispatch(&orgQuery); err != nil {
		if err == m.ErrOrgNotFound {
			return a.createGrafanaOrg(orgname)
		} else {
			return nil, err
		}
	}

	return orgQuery.Result, nil
}

func (a *keystoneAuther) createGrafanaOrg(orgname string) (*m.Org, error) {
	cmd := m.CreateOrgCommand{
		Name: orgname,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return nil, err
	}

	return &cmd.Result, nil
}

func (a *keystoneAuther) removeGrafanaOrgUser(userid, orgid int64) error {
	cmd := m.RemoveOrgUserCommand{
		UserId: userid,
		OrgId:  orgid,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		// Ignore change if user is the last admin
		if err != m.ErrLastOrgAdmin {
			return err
		}
	}
	return nil
}

func (a *keystoneAuther) updateGrafanaOrgUser(userid, orgid int64, role m.RoleType) error {
	cmd := m.UpdateOrgUserCommand{
		UserId: userid,
		Role:   role,
		OrgId:  orgid,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		// Ignore change if user is the last admin
		if err != m.ErrLastOrgAdmin {
			return err
		}
	}
	return nil
}

func (a *keystoneAuther) syncOrgRoles(username, password string, user *m.User) error {
	err := a.getProjectList(username, password)
	if err != nil {
		return err
	}

	orgsQuery := m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}

	// update or remove org roles
	for _, org := range orgsQuery.Result {
		handledOrgIds[org.OrgId] = true

		if user_roles, ok := a.project_list[org.Name]; ok {
			// Update roles if user belongs to org
			role_name := a.getRole(user_roles)
			if role_name != "" {
				if err := a.updateGrafanaOrgUser(user.Id, org.OrgId, role_name); err != nil {
					return err
				}
			} else {
				// remove user if no permissions
				if err := a.removeGrafanaOrgUser(user.Id, org.OrgId); err != nil {
					return err
				}
			}
		} else {
			// remove role if no mappings match
			if err := a.removeGrafanaOrgUser(user.Id, org.OrgId); err != nil {
				return err
			}
		}
	}

	// add missing org roles
	for project, _ := range a.project_list {
		if grafanaOrg, err := a.getGrafanaOrgFor(project); err != nil {
			return err
		} else {
			if _, exists := handledOrgIds[grafanaOrg.Id]; exists {
				continue
			}

			// add role
			role_name := a.getRole(a.project_list[project])
			if role_name != "" {
				cmd := m.AddOrgUserCommand{UserId: user.Id, Role: role_name, OrgId: grafanaOrg.Id}
				if err := bus.Dispatch(&cmd); err != nil {
					return err
				}
			}

			// mark this tenant has handled so we do not process it again
			handledOrgIds[grafanaOrg.Id] = true
		}
	}

	// set or unset admin permissions
	isAdmin := false
	role_map := make(map[string]bool)
	for _, role := range a.admin_roles {
		role_map[role] = true
	}
	for project, _ := range a.project_list {
		if isAdmin == true {
			break
		}
		project_roles := a.project_list[project]
		for _, role := range project_roles {
			if _, ok := role_map[role]; ok {
				isAdmin = true
				break
			}
		}
	}
	if isAdmin != user.IsAdmin {
		if err := a.updateGrafanaUserPermissions(user.Id, isAdmin); err != nil {
			return err
		}
	}

	orgsQuery = m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		return err
	}

	if len(orgsQuery.Result) == 0 {
		return errors.New("Keystone authentication failed: No grafana permissions")
	}

	match := false
	var orgid int64
	for _, org := range orgsQuery.Result {
		orgid = org.OrgId
		if user.OrgId == orgid {
			match = true
			break
		}
	}

	// set org if none is set (for new users), or if user no longer has permissions for the current org
	if (user.OrgId == 1) || (match == false) {
		cmd := m.SetUsingOrgCommand{UserId: user.Id, OrgId: orgid}
		if err := bus.Dispatch(&cmd); err != nil {
			return err
		}
	}

	return nil
}

func (a *keystoneAuther) getProjectList(username, password string) error {
	projects_data := keystone.Projects_data{
		Token:  a.token,
		Server: a.server,
	}
	if err := keystone.GetProjects(&projects_data); err != nil {
		return err
	}
	projects := projects_data.Projects
	a.project_list = make(map[string][]string)
	for _, project := range projects {
		var auth keystone.Auth_data
		auth.Server = a.server
		auth.Domain = a.domainname
		auth.Project = project
		auth.UnscopedToken = a.token
		if err := keystone.AuthenticateScoped(&auth); err != nil {
			return err
		}
		var roles []string
		for _, role := range auth.Roles {
			roles = append(roles, role.Name)
		}
		a.project_list[project] = roles
	}
	return nil
}

func (a *keystoneAuther) getRole(user_roles []string) m.RoleType {
	role_map := make(map[string]bool)
	for _, role := range user_roles {
		role_map[role] = true
	}
	role_order := []m.RoleType{m.ROLE_ADMIN, m.ROLE_EDITOR, m.ROLE_READ_ONLY_EDITOR, m.ROLE_VIEWER}
	for _, role_type := range role_order {
		for _, role := range a.roles[role_type] {
			if _, ok := role_map[role]; ok {
				return role_type
			}
		}
	}
	return ""
}
