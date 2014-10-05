package rethink

import (
	"errors"
	"time"

	r "github.com/dancannon/gorethink"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/models"
)

var (
	session *r.Session
	dbName  string = "grafana"
)

func Init() {
	log.Info("Initializing rethink storage")

	var err error
	session, err = r.Connect(r.ConnectOpts{
		Address:     "localhost:28015",
		Database:    dbName,
		MaxIdle:     10,
		IdleTimeout: time.Second * 10,
	})

	if err != nil {
		log.Error(3, "Failed to connect to rethink database %v", err)
	}

	createRethinkDBTablesAndIndices()

	models.GetAccount = GetAccount
	models.GetAccountByLogin = GetAccountByLogin
}

func createRethinkDBTablesAndIndices() {

	r.DbCreate(dbName).Exec(session)

	// create tables
	r.Db(dbName).TableCreate("dashboards").Exec(session)
	r.Db(dbName).TableCreate("accounts").Exec(session)
	r.Db(dbName).TableCreate("master").Exec(session)

	// create dashboard  accountId + slug index
	r.Db(dbName).Table("dashboards").IndexCreateFunc("AccountIdSlug", func(row r.Term) interface{} {
		return []interface{}{row.Field("AccountId"), row.Field("Slug")}
	}).Exec(session)

	r.Db(dbName).Table("dashboards").IndexCreate("AccountId").Exec(session)
	r.Db(dbName).Table("accounts").IndexCreate("Login").Exec(session)

	// create account collaborator index
	r.Db(dbName).Table("accounts").
		IndexCreateFunc("CollaboratorAccountId", func(row r.Term) interface{} {
		return row.Field("Collaborators").Map(func(row r.Term) interface{} {
			return row.Field("AccountId")
		})
	}, r.IndexCreateOpts{Multi: true}).Exec(session)

	// make sure master ids row exists
	_, err := r.Table("master").Insert(map[string]interface{}{"id": "ids", "NextAccountId": 0}).RunWrite(session)
	if err != nil {
		log.Error(3, "Failed to insert master ids row", err)
	}
}

func getNextAccountId() (int, error) {
	resp, err := r.Table("master").Get("ids").Update(map[string]interface{}{
		"NextAccountId": r.Row.Field("NextAccountId").Add(1),
	}, r.UpdateOpts{ReturnChanges: true}).RunWrite(session)

	if err != nil {
		return 0, err
	}

	change := resp.Changes[0]

	if change.NewValue == nil {
		return 0, errors.New("Failed to get new value after incrementing account id")
	}

	return int(change.NewValue.(map[string]interface{})["NextAccountId"].(float64)), nil
}

func CreateAccount(account *models.Account) error {
	accountId, err := getNextAccountId()
	if err != nil {
		return err
	}

	account.Id = accountId
	account.UsingAccountId = accountId

	resp, err := r.Table("accounts").Insert(account).RunWrite(session)
	if err != nil {
		return err
	}

	if resp.Inserted == 0 {
		return errors.New("Failed to insert acccount")
	}

	return nil
}

func GetAccountByLogin(emailOrName string) (*models.Account, error) {
	resp, err := r.Table("accounts").GetAllByIndex("Login", emailOrName).Run(session)

	if err != nil {
		return nil, err
	}

	var account models.Account
	err = resp.One(&account)
	if err != nil {
		return nil, models.ErrAccountNotFound
	}

	return &account, nil
}

func GetAccount(id int) (*models.Account, error) {
	resp, err := r.Table("accounts").Get(id).Run(session)

	if err != nil {
		return nil, err
	}

	var account models.Account
	err = resp.One(&account)
	if err != nil {
		return nil, errors.New("Not found")
	}

	return &account, nil
}

func UpdateAccount(account *models.Account) error {
	resp, err := r.Table("accounts").Update(account).RunWrite(session)
	if err != nil {
		return err
	}

	if resp.Replaced == 0 && resp.Unchanged == 0 {
		return errors.New("Could not find account to update")
	}

	return nil
}

func getNextDashboardNumber(accountId int) (int, error) {
	resp, err := r.Table("accounts").Get(accountId).Update(map[string]interface{}{
		"NextDashboardId": r.Row.Field("NextDashboardId").Add(1),
	}, r.UpdateOpts{ReturnChanges: true}).RunWrite(session)

	if err != nil {
		return 0, err
	}

	change := resp.Changes[0]

	if change.NewValue == nil {
		return 0, errors.New("Failed to get next dashboard id, no new value after update")
	}

	return int(change.NewValue.(map[string]interface{})["NextDashboardId"].(float64)), nil
}

func GetOtherAccountsFor(accountId int) ([]*models.OtherAccount, error) {
	resp, err := r.Table("accounts").
		GetAllByIndex("CollaboratorAccountId", accountId).
		Map(func(row r.Term) interface{} {
		return map[string]interface{}{
			"id":   row.Field("id"),
			"Name": row.Field("Email"),
			"Role": row.Field("Collaborators").Filter(map[string]interface{}{
				"AccountId": accountId,
			}).Nth(0).Field("Role"),
		}
	}).Run(session)

	if err != nil {
		return nil, err
	}

	var list []*models.OtherAccount
	err = resp.All(&list)
	if err != nil {
		return nil, errors.New("Failed to read available accounts")
	}

	return list, nil
}
