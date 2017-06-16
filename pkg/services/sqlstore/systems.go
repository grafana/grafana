package sqlstore

import (
  "github.com/go-xorm/xorm"
  "github.com/gosimple/slug"
  "github.com/wangy1931/grafana/pkg/bus"
  m "github.com/wangy1931/grafana/pkg/models"
  "github.com/wangy1931/grafana/pkg/api/dtos"
  "github.com/wangy1931/grafana/pkg/components/apikeygen"
  "bytes"
  "strconv"
  "errors"
)

func init() {
  bus.AddHandler("sql", GetServicesByOrgId)
  bus.AddHandler("sql", GetSystemsByUserId)
  bus.AddHandler("sql", GetDashboardsOfUser)
  bus.AddHandler("sql", GetCurrentSystemDashboards)
  bus.AddHandler("sql", AddSystem)
  bus.AddHandler("sql", AddSystemsUser)
  bus.AddHandler("sql", AddSystemDash)
  bus.AddHandler("sql", AddSystemPick)
  bus.AddHandler("sql", UpdateSystems)
  bus.AddHandler("sql", UpdateUserSystems)
  bus.AddHandler("sql", UpdateDashSystems)
  bus.AddHandler("sql", GetSystemPick)
}

func AddSystem(cmd *m.AddSystemsCommand) error {
  return inTransaction(func(sess *xorm.Session) error {
    // check if service exists
    var err error
    for _, systemName := range cmd.SystemsName {
      if res, err := sess.Query("SELECT 1 from systems WHERE systems_name=? and org_id=?", systemName, cmd.OrgId); err != nil {
        return err
      } else if len(res) == 1 {
        return m.ErrSystemAlreadyAdded
      }

      entity := m.Systems{
        OrgId:        cmd.OrgId,
        SystemsName:  systemName,
        Slug:         slug.Make(systemName),
      }

      _, err = sess.Insert(&entity)

      apiEntity := m.AddApiKeyCommand{}
      apiEntity.OrgId = cmd.OrgId
      apiEntity.Name = strconv.FormatInt(entity.Id,10)
      apiEntity.Role = m.ROLE_ADMIN
      newKeyInfo := apikeygen.New(apiEntity.OrgId, apiEntity.Name)
      apiEntity.Key = newKeyInfo.HashedKey
      err = AddApiKey(&apiEntity)
    }
    return err
  })
}

func AddSystemsUser(cmd *m.AddSystemsUserCommand) error {
  return inTransaction(func(sess *xorm.Session) error {
    // check if service exists
    var err error
    for _, sid := range cmd.SystemsId {
      entity := m.SystemUser{
        SystemId: sid,
        UserId:   cmd.InviteCode,
      }

      _, err = sess.Insert(&entity)
    }
    return err
  })
}

func AddSystemDash(cmd *m.AddSystemDashboardCommand) error {
  return inTransaction(func(sess *xorm.Session) error {
    if res, err := sess.Query("select 1 from system_dash where dashboard_id = ?", cmd.DashId); err != nil {
      return err
    }else if len(res) == 1 {
      update_dash := m.UpdateSystemDashboardCommand{}
      update_dash.DashId = cmd.DashId
      update_dash.SystemId = cmd.SystemId
      return UpdateDashSystems(&update_dash)
    }

    dashId, _ := strconv.ParseInt(cmd.DashId, 10, 64)

    entity := m.SystemDash{
      SystemId:      cmd.SystemId,
      DashboardId:   dashId,
    }
    _, err := sess.Insert(&entity)
    return err
  })
}

func AddSystemPick(cmd *m.AddOrUpdateSystemPick) error {
  return inTransaction(func(sess *xorm.Session) error {
    if res, err := sess.Query("select 1 from system_pick where user_id = ?", cmd.UserId); err != nil {
      return err
    }else if len(res) == 1 {
      update_pick := m.SystemPick{}
      update_pick.UserId = cmd.UserId
      update_pick.SystemId = cmd.SystemId
      return UpdatePickSystem(&update_pick)
    }

    entity := m.SystemPick{
      SystemId:      cmd.SystemId,
      UserId:        cmd.UserId,
    }
    _, err := sess.Insert(&entity)
    return err
  })
}

func UpdateSystems(systems *dtos.UpdateSystems) error {
  return inTransaction2(func(sess *session) error {
    for _, system := range systems.System {
      if _, err := sess.Id(system.Id).Update(&system); err != nil {
        return err
      }
    }
    return nil
  })
}

//TODO too much thing to do
func UpdateUserSystems(system *m.UpdateUserSystemCommond) error {
  return inTransaction2(func(sess *session) error {
    if _, err := sess.Exec("update system_user set user_id=? where user_id=?", system.UserId, system.InviteCode); err != nil {
      return err
    }
    return nil
  })
}

func UpdateDashSystems(system_dash *m.UpdateSystemDashboardCommand) error {
  return inTransaction2(func(sess *session) error {
    if _, err := sess.Exec("update system_dash set system_id=? where dashboard_id=?", system_dash.SystemId, system_dash.DashId); err != nil {
      return err
    }
    return nil
  })
}

func UpdatePickSystem(system_pick *m.SystemPick) error {
  return inTransaction2(func(sess *session) error {
    if _, err := sess.Exec("update system_pick set system_id=? where user_id=?", system_pick.SystemId, system_pick.UserId); err != nil {
      return err
    }
    return nil
  })
}

func GetServicesByOrgId(query *m.GetOrgSystemsQuery) error {
  query.Result = make([]*m.Systems, 0)
  sess := x.Table("systems")
  sess.Where("systems.org_id=?", query.OrgId)
  err := sess.Find(&query.Result)
  return err
}

func GetSystemsByUserId(query *m.GetUserSystemsQuery) error {
  var sql bytes.Buffer
  query.Result = make([]*m.Systems, 0)
  params := make([]interface{}, 0)

  sql.WriteString("select systems.* from systems JOIN `system_user` ON systems.id = system_id WHERE system_user.user_id=?")
  params = append(params, query.UserId)
  err := x.Sql(sql.String(), params...).Find(&query.Result)
  return err
}

func GetDashboardsOfUser(query *m.GetCurrentDashboardDashboard) error {
  var sql bytes.Buffer
  query.Result = make([]*m.SystemDash, 0)
  params := make([]interface{}, 0)

  sql.WriteString("select system_dash.* from system_user right join system_dash on system_dash.system_id = system_user.system_id where user_id = ?")
  params = append(params, query.UserId)
  err := x.Sql(sql.String(), params...).Find(&query.Result)
  return err
}

func GetCurrentSystemDashboards(query *m.GetCurrentSystemDashboards) error {
  sess := x.Table("system_dash")
  sess.Where("system_dash.system_id=?", query.SystemId)
  err := sess.Find(&query.Result)
  return err
}

func GetSystemPick(query *m.GetSystemPick) error {
  var systemPick m.SystemPick
  sess := x.Table("system_pick")
  sess.Where("system_pick.user_id=?", query.UserId)
  _, err := sess.Get(&systemPick)
  query.Result = &systemPick
  if (query.Result == nil) {
    return errors.New("can not find any system")
  }
  return err
}