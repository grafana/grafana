// +build go1.10

package pq_test

import (
	"database/sql"
	"fmt"

	"gitee.com/opengauss/openGauss-connector-go-pq"
)

func ExampleNewConnector() {
	name := ""
	connector, err := pq.NewConnector(name)
	if err != nil {
		fmt.Println(err)
		return
	}
	db := sql.OpenDB(connector)
	defer db.Close()

	// Use the DB
	txn, err := db.Begin()
	if err != nil {
		fmt.Println(err)
		return
	}
	txn.Rollback()
}
