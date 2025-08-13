// Copyright © 2021 Bin Liu <bin.liu@enmotech.com>

package main

import (
	"database/sql"
	"fmt"
	_ "gitee.com/opengauss/openGauss-connector-go-pq"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

/*
需要有访问dbe_perf.global_instance_time的权限
CREATE USER dbuser_monitor with login monadmin PASSWORD 'Mon@1234';
grant usage on schema dbe_perf to dbuser_monitor;
grant select on dbe_perf.global_instance_time to dbuser_monitor;
CGO_ENABLED=0 GOOS=linux GOARCH=arm64
*/

var (
	/*
		target_session_attrs 	--> Set the connection database properties
		connect_timeout			--> Set connect timeout. unit second
	*/
	dsnExample = `DSN="postgres://gaussdb:secret@foo,bar,baz/mydb?sslmode=disable&target_session_attrs=primary&connect_timeout=1"
DSN="postgres://gaussdb:secret@foo:1,bar:2,baz:3/mydb?sslmode=disable&target_session_attrs=primary&connect_timeout=1"
DSN="user=gaussdb password=secret host=foo,bar,baz port=5432 dbname=mydb sslmode=disable target_session_attrs=primary connect_timeout=1"
DSN="user=gaussdb password=secret host=foo,bar,baz port=5432,5432,5433 dbname=mydb sslmode=disable target_session_attrs=primary connect_timeout=1"`
)

func main() {
	connStr := os.Getenv("DSN")
	if connStr == "" {
		fmt.Println("please define the env DSN. example:\n" + dsnExample)
		return
	}
	fmt.Println("DNS:", connStr)
	db, err := sql.Open("opengauss", connStr)
	if err != nil {
		log.Fatal(err)
	}
	var (
		newTimer = time.NewTicker(500 * time.Millisecond)
		doClose  = make(chan struct{}, 1)
	)
	go func() {
		for {
			select {
			case <-newTimer.C:
				if err := getNodeName(db); err != nil {
					fmt.Println(err)
				}
			case <-doClose:
				newTimer.Stop()
				return
			}
		}
	}()
	sigChan := make(chan os.Signal, 2)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT, syscall.SIGKILL) //nolint:staticcheck
	defer signal.Stop(sigChan)
	<-sigChan
	doClose <- struct{}{}

}

func getNodeName(db *sql.DB) error {
	var err error
	var sysdate string
	var pgIsInRecovery bool
	var nodeName string
	err = db.QueryRow("select sysdate,pg_is_in_recovery();").
		Scan(&sysdate, &pgIsInRecovery)
	if err != nil {
		return err
	}
	var channel string
	fmt.Println(sysdate, nodeName, pgIsInRecovery, channel)
	return nil
}
