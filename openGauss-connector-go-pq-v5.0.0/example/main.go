// Copyright © 2021 Bin Liu <bin.liu@enmotech.com>

package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "gitee.com/opengauss/openGauss-connector-go-pq"
)

func main() {
	connStr := "host=127.0.0.1 port=5433 user=gaussdb password=mtkOP@128 dbname=postgres sslmode=disable"
	db, err := sql.Open("opengauss", connStr)
	if err != nil {
		log.Fatal(err)
	}
	var date string
	err = db.QueryRow("select current_date ").Scan(&date)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(date)
}
