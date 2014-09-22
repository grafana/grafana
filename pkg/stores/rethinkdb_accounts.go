package stores

import (
	"errors"

	r "github.com/dancannon/gorethink"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func (self *rethinkStore) getNextAccountId() (int, error) {
	resp, err := r.Table("master").Get("ids").Update(map[string]interface{}{
		"NextAccountId": r.Row.Field("NextAccountId").Add(1),
	}, r.UpdateOpts{ReturnChanges: true}).RunWrite(self.session)

	if err != nil {
		return 0, err
	}

	change := resp.Changes[0]

	if change.NewValue == nil {
		return 0, errors.New("Failed to get new value after incrementing account id")
	}

	return int(change.NewValue.(map[string]interface{})["NextAccountId"].(float64)), nil
}

func (self *rethinkStore) CreateAccount(account *models.Account) error {
	accountId, err := self.getNextAccountId()
	if err != nil {
		return err
	}

	account.Id = accountId
	account.UsingAccountId = accountId

	resp, err := r.Table("accounts").Insert(account).RunWrite(self.session)
	if err != nil {
		return err
	}

	if resp.Inserted == 0 {
		return errors.New("Failed to insert acccount")
	}

	return nil
}

func (self *rethinkStore) GetAccountByLogin(emailOrName string) (*models.Account, error) {
	resp, err := r.Table("accounts").GetAllByIndex("Login", emailOrName).Run(self.session)

	if err != nil {
		return nil, err
	}

	var account models.Account
	err = resp.One(&account)
	if err != nil {
		return nil, ErrAccountNotFound
	}

	return &account, nil
}

func (self *rethinkStore) GetAccount(id int) (*models.Account, error) {
	resp, err := r.Table("accounts").Get(id).Run(self.session)

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

func (self *rethinkStore) UpdateAccount(account *models.Account) error {
	resp, err := r.Table("accounts").Update(account).RunWrite(self.session)
	if err != nil {
		return err
	}

	if resp.Replaced == 0 && resp.Unchanged == 0 {
		return errors.New("Could not find account to update")
	}

	return nil
}

func (self *rethinkStore) getNextDashboardNumber(accountId int) (int, error) {
	resp, err := r.Table("accounts").Get(accountId).Update(map[string]interface{}{
		"NextDashboardId": r.Row.Field("NextDashboardId").Add(1),
	}, r.UpdateOpts{ReturnChanges: true}).RunWrite(self.session)

	if err != nil {
		return 0, err
	}

	change := resp.Changes[0]

	if change.NewValue == nil {
		return 0, errors.New("Failed to get next dashboard id, no new value after update")
	}

	return int(change.NewValue.(map[string]interface{})["NextDashboardId"].(float64)), nil
}

func (self *rethinkStore) GetOtherAccountsFor(accountId int) ([]*models.OtherAccount, error) {
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
	}).Run(self.session)

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
