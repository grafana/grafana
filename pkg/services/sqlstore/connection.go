package sqlstore

import "github.com/jmoiron/sqlx"

type DBConnection struct {
	*sqlx.Conn
	transactionOpen bool
	// events          []interface{}
}
