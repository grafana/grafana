package sqlstore

import "github.com/torkelo/grafana-pro/pkg/models"

func SaveAccount(account *models.Account) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if account.Id == 0 {
		_, err = sess.Insert(account)
	} else {
		_, err = sess.Id(account.Id).Update(account)
	}

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetAccount(id int64) (*models.Account, error) {
	var err error

	var account models.Account
	has, err := x.Id(id).Get(&account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, models.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	return &account, nil
}

func GetAccountByLogin(emailOrLogin string) (*models.Account, error) {
	var err error

	account := &models.Account{Login: emailOrLogin}
	has, err := x.Get(account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, models.ErrAccountNotFound
	}

	return account, nil
}

func GetCollaboratorsForAccount(accountId int64) ([]*models.CollaboratorInfo, error) {
	collaborators := make([]*models.CollaboratorInfo, 0)

	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "account.id=collaborator.account_Id")
	sess.Where("collaborator.for_account_id=?", accountId)
	err := sess.Find(&collaborators)

	return collaborators, err
}

func AddCollaborator(collaborator *models.Collaborator) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if _, err = sess.Insert(collaborator); err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetOtherAccountsFor(accountId int64) ([]*models.OtherAccount, error) {
	collaborators := make([]*models.OtherAccount, 0)
	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "account.id=collaborator.account_Id")
	sess.Where("account_id=?", accountId)
	err := sess.Find(&collaborators)
	return collaborators, err
}
