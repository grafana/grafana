package stores

import (
	"errors"

	r "github.com/dancannon/gorethink"
)

func (self *rethinkStore) getNextAccountId() (int, error) {
	resp, err := r.Table("master").Get("ids").Update(map[string]interface{}{
		"NextAccountId": r.Row.Field("NextAccountId").Add(1),
	}, r.UpdateOpts{ReturnVals: true}).RunWrite(self.session)

	if err != nil {
		return 0, err
	}

	if resp.NewValue == nil {
		return 0, errors.New("Failed to get new value after incrementing account id")
	}

	return int(resp.NewValue.(map[string]interface{})["NextAccountId"].(float64)), nil
}

func (self *rethinkStore) createAccount() (*Account, error) {
	accountId, err := self.getNextAccountId()
	if err != nil {
		return nil, err
	}

	account := &Account{Id: accountId, NextDashboardId: 0}

	resp, err := r.Table("accounts").Insert(account).RunWrite(self.session)
	if err != nil {
		return nil, err
	}

	if resp.Inserted == 0 {
		return nil, errors.New("Failed to insert acccount")
	}

	return account, nil
}

func (self *rethinkStore) getNextDashboardNumber(accountId int) (int, error) {
	resp, err := r.Table("accounts").Get(accountId).Update(map[string]interface{}{
		"NextDashboardId": r.Row.Field("NextDashboardId").Add(1),
	}, r.UpdateOpts{ReturnVals: true}).RunWrite(self.session)

	if err != nil {
		return 0, err
	}

	if resp.NewValue == nil {
		return 0, errors.New("Failed to get next dashboard id, no new value after update")
	}

	return int(resp.NewValue.(map[string]interface{})["NextDashboardId"].(float64)), nil
}
