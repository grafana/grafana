package sqlstore

import (
  "github.com/wangy1931/grafana/pkg/bus"

  m "github.com/wangy1931/grafana/pkg/models"
  "time"
)

func init() {
  bus.AddHandler("sql", CreateProposeUser)
  bus.AddHandler("sql", UpdateProposeUserStatus)
  bus.AddHandler("sql", GetAllUsers)
}

func CreateProposeUser(cmd *m.CreateProposeUserCommand) error {
  return inTransaction2(func(sess *session) error {

    // create user
    user := &m.ProposeUser{
      Email:           cmd.Email,
      Name:            cmd.Name,
      Phone:           cmd.Phone,
      Org:             cmd.Org,
      Scale:           cmd.Scale,
      Status:          m.ProposeStarted,
      Created:         time.Now(),
    }

    if _, err := sess.Insert(user); err != nil {
      return err
    }

    cmd.Result = user
    return nil
  })
}

func UpdateProposeUserStatus(cmd *m.UpdateProposeUserStatus) error {
  return inTransaction2(func(sess *session) error {
    if _, err := sess.Exec("update propose_user set status=? where id=?", cmd.Status, cmd.Id); err != nil {
      return err
    }
    return nil
  })
}

func GetAllUsers(query *m.GetAllProposeUsers) error {
  query.Result = make([]*m.ProposeUser, 0)
  sess := x.Table("propose_user")
  err := sess.Find(&query.Result)
  return err
}
