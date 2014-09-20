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
	resp, err := r.Table("accounts").GetAllByIndex("AccountLogin", []interface{}{emailOrName}).Run(self.session)

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

	if resp.Replaced != 1 {
		return errors.New("Could not fund account to uodate")
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
