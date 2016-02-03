package login

import (
    "bytes"
    "encoding/json"
    "errors"
    "net/http"

    "github.com/grafana/grafana/pkg/bus"
    m "github.com/grafana/grafana/pkg/models"
)

type keystoneAuther struct {
    server            string
    v3                bool
    userdomainname    string
    token             string
    tenants           []tenant_struct
}

type v2_auth_response_struct struct {
    Access v2_access_struct
}

type v2_access_struct struct {
    Token v2_token_struct
}

type v2_token_struct struct {
    Id string
}

type v2_auth_post_struct struct {
    Auth v2_auth_struct  `json:"auth"`
}

type v2_auth_struct struct {
    PasswordCredentials v2_credentials_struct  `json:"passwordCredentials"`
}

type v2_credentials_struct struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type v2_tenant_response_struct struct{
    Tenants []tenant_struct
}

type tenant_struct struct {
    Name string
}

type v3_auth_post_struct struct {
    Auth v3_auth_struct  `json:"auth"`
}

type v3_auth_struct struct {
    PasswordCredentials v3_identity_struct  `json:"identity"`
}

type v3_identity_struct struct {
    Methods []string  `json:"methods"`
    PasswordMethod v3_passwordmethod_struct  `json:"password"`
}

type v3_passwordmethod_struct struct {
    User v3_user_struct `json:"user"`
}

type v3_user_struct struct {
    Name string `json:"name"`
    Password string `json:"password"`
    Domain v3_userdomain_struct `json:"domain"`
}

type v3_userdomain_struct struct {
    Name string `json:"name"`
}

type v3_project_response_struct struct{
    Projects []tenant_struct
}

func NewKeystoneAuthenticator(server string, v3 bool, userdomainaname string) *keystoneAuther {
    return &keystoneAuther{server: server, v3: v3, userdomainname: userdomainaname}
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
        if err := a.syncOrgRoles(grafanaUser); err != nil {
            return err
        }
        query.User = grafanaUser
        return nil
    }

}

func (a *keystoneAuther) authenticate(username, password string) error {
    if a.v3 {
        if err := a.authenticateV3(username, password); err != nil {
            return err
        }
    } else {
        if err := a.authenticateV2(username, password); err != nil {
            return err
        }
    }
    return nil
}

func (a *keystoneAuther) authenticateV2(username, password string) error {
    var auth_post v2_auth_post_struct
    auth_post.Auth.PasswordCredentials.Username = username
    auth_post.Auth.PasswordCredentials.Password = password
    b, _ := json.Marshal(auth_post)

    request, err := http.NewRequest("POST", a.server + "/v2.0/tokens", bytes.NewBuffer(b))
    if err != nil {
        return err
    }

    client := &http.Client{}
    resp, err := client.Do(request)
    if err != nil {
        return err
    } else if resp.StatusCode != 200 {
        return errors.New("Keystone authentication failed: " + resp.Status)
    }

    decoder := json.NewDecoder(resp.Body)
    var auth_response v2_auth_response_struct
    err = decoder.Decode(&auth_response)
    if err != nil {
        return err
    }

    a.token = auth_response.Access.Token.Id
    return nil
}

func (a *keystoneAuther) authenticateV3(username, password string) error {
    var auth_post v3_auth_post_struct
    auth_post.Auth.PasswordCredentials.Methods = []string{"password"}
    auth_post.Auth.PasswordCredentials.PasswordMethod.User.Name = username
    auth_post.Auth.PasswordCredentials.PasswordMethod.User.Password = password
    // the user domain name is currently hardcoded via a config setting - this should change to an extra domain field in the login dialog later
    auth_post.Auth.PasswordCredentials.PasswordMethod.User.Domain.Name = a.userdomainname
    b, _ := json.Marshal(auth_post)

    request, err := http.NewRequest("POST", a.server + "/v3/auth/tokens", bytes.NewBuffer(b))
    if err != nil {
        return err
    }

    client := &http.Client{}
    resp, err := client.Do(request)
    if err != nil {
        return err
    } else if resp.StatusCode != 201 {
        return errors.New("Keystone authentication failed: " + resp.Status)
    }

    // in keystone v3 the token is in the response header
    a.token = resp.Header.Get("X-Subject-Token")

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

func (a *keystoneAuther) syncOrgRoles(user *m.User) error {
    err := a.getTenantList()
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
        match := false
        handledOrgIds[org.OrgId] = true

        // search for matching tenant
        for _, tenant := range a.tenants {
            if org.Name == tenant.Name {
                match = true
                break
            }
        }

        // remove role if no mappings match
        if !match {
            cmd := m.RemoveOrgUserCommand{OrgId: org.OrgId, UserId: user.Id}
            if err := bus.Dispatch(&cmd); err != nil {
                // Ignore remove org user if user is the last admin
                if err != m.ErrLastOrgAdmin {
                    return err
                }
            }
        }
    }

    // add missing org roles
    for _, tenant := range a.tenants {
        if grafanaOrg, err := a.getGrafanaOrgFor(tenant.Name); err != nil {
            return err
        } else {
            if _, exists := handledOrgIds[grafanaOrg.Id]; exists {
                continue
            }

            // add role
            cmd := m.AddOrgUserCommand{UserId: user.Id, Role: "Editor", OrgId: grafanaOrg.Id}
            if err := bus.Dispatch(&cmd); err != nil {
                return err
            }

            // set org if none is set (for new users)
            if user.OrgId == 1 {
                cmd := m.SetUsingOrgCommand{UserId: user.Id, OrgId: grafanaOrg.Id}
                if err := bus.Dispatch(&cmd); err != nil {
                    return err
                }
            }

            // mark this tenant has handled so we do not process it again
            handledOrgIds[grafanaOrg.Id] = true
        }
    }

    return nil
}

func (a *keystoneAuther) getTenantList() error {
    if a.v3 {
        if err := a.getProjectListV3(); err != nil {
            return err
        }
    } else {
        if err := a.getTenantListV2(); err != nil {
            return err
        }
    }
    return nil
}

func (a *keystoneAuther) getTenantListV2() error {
    request, err := http.NewRequest("GET", a.server + "/v2.0/tenants", nil)
    if err != nil {
        return err
    }
    request.Header.Add("X-Auth-Token", a.token)

    client := &http.Client{}
    resp, err := client.Do(request)
    if err != nil {
        return err
    } else if resp.StatusCode != 200 {
        return errors.New("Keystone tenant-list failed: " + resp.Status)
    }

    decoder := json.NewDecoder(resp.Body)
    var tenant_response v2_tenant_response_struct
    err = decoder.Decode(&tenant_response)
    if err != nil {
        return err
    }
    a.tenants = tenant_response.Tenants
    return nil
}

func (a *keystoneAuther) getProjectListV3() error {
    request, err := http.NewRequest("GET", a.server + "/v3/auth/projects", nil)
    if err != nil {
        return err
    }
    request.Header.Add("X-Auth-Token", a.token)

    client := &http.Client{}
    resp, err := client.Do(request)
    if err != nil {
        return err
    } else if resp.StatusCode != 200 {
        return errors.New("Keystone project-list failed: " + resp.Status)
    }

    decoder := json.NewDecoder(resp.Body)
    var project_response v3_project_response_struct
    err = decoder.Decode(&project_response)
    if err != nil {
        return err
    }
    a.tenants = project_response.Projects
    return nil
}
