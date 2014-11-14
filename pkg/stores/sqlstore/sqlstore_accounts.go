package sqlstore

import "github.com/torkelo/grafana-pro/pkg/log"

func SaveAccount() error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	u := &AccountDto{
		Email:  "asdasdas",
		Passwd: "MyPassWd",
	}

	if _, err = sess.Insert(u); err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetAccounts() {
	var resp = make([]*AccountDto, 1)
	err := x.Find(&resp)
	if err != nil {
		log.Error(4, "Error", err)
	}

	for _, i := range resp {
		log.Info("Item %v", i)
	}
}
