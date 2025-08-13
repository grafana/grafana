// +build go1.10

package pq_test

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"gitee.com/opengauss/openGauss-connector-go-pq"
)

func getTestDsn() (string, error) {
	dsn := os.Getenv("TEST_CONN_STRING")
	if dsn == "" {
		return "", fmt.Errorf("not define TEST_CONN_STRING env")
	}
	return dsn, nil
}

func ExampleConnectorWithNoticeHandler() {
	name, err := getTestDsn()
	if err != nil {
		log.Fatal(err)
	}
	// Base connector to wrap
	base, err := pq.NewConnector(name)
	if err != nil {
		log.Fatal(err)
	}
	// Wrap the connector to simply print out the message
	connector := pq.ConnectorWithNoticeHandler(base, func(notice *pq.Error) {
		fmt.Println("Notice sent: " + notice.Message)
	})
	db := sql.OpenDB(connector)
	defer db.Close()
	// Raise a notice
	sql := "DO language plpgsql $$ BEGIN RAISE NOTICE 'test notice'; END $$"
	if _, err := db.Exec(sql); err != nil {
		log.Fatal(err)
	}
	// Output:
	// Notice sent: test notice
}
