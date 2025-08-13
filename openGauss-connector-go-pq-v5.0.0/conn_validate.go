// 2022/1/14 Bin Liu <bin.liu@enmotech.com>

package pq

import (
	"context"
	"database/sql/driver"
	"errors"
	"strings"
)

type ValidateConnectFunc func(conn *conn) error

const (
	showTransactionReadOnly = "show transaction_read_only"
	pgIsInRecovery          = "select pg_is_in_recovery()"
)

func validateConnectTargetSessionAttrsTransaction(cn *conn, expectedStatus string) (bool, error) {
	cn.log(
		context.Background(), LogLevelDebug, "Check server is transaction_read_only ?", map[string]interface{}{
			"sql":     showTransactionReadOnly,
			paramHost: cn.config.Host, paramPort: cn.config.Port, paramTargetSessionAttrs: cn.config.targetSessionAttrs,
		},
	)
	inReRows, err := cn.query(showTransactionReadOnly, nil)
	defer inReRows.Close()
	var dbTranReadOnly string
	lastCols := []driver.Value{&dbTranReadOnly}
	err = inReRows.Next(lastCols)
	if err != nil {
		cn.log(context.Background(), LogLevelDebug, "err:"+err.Error(), map[string]interface{}{})
		return false, err
	}
	readOnly := lastCols[0].(string)
	cn.log(
		context.Background(), LogLevelDebug, "Check server is readOnly ?", map[string]interface{}{
			"readOnly": readOnly,
			paramHost:  cn.config.Host, paramPort: cn.config.Port,
		},
	)
	if strings.EqualFold(readOnly, expectedStatus) {
		return true, nil
	}
	return false, nil
}

func ValidateConnectTargetSessionAttrsReadWrite(cn *conn) error {
	// omm=# show transaction_read_only;
	// transaction_read_only
	// -----------------------
	// 	off
	// (1 row)
	b, err := validateConnectTargetSessionAttrsTransaction(cn, "off")
	if err != nil {
		return err
	}
	if !b {
		return errors.New("connection is not read write")
	}
	return nil
}

func ValidateConnectTargetSessionAttrsReadOnly(cn *conn) error {
	// omm=# show transaction_read_only;
	// transaction_read_only
	// -----------------------
	// 	on
	// (1 row)
	b, err := validateConnectTargetSessionAttrsTransaction(cn, "on")
	if err != nil {
		return err
	}
	if !b {
		return errors.New("connection is not read only")
	}
	return nil
}

func validateConnectTargetSessionAttrsRecovery(cn *conn, expectedIsRecovery bool) (bool, error) {
	cn.log(context.Background(), LogLevelDebug, "check  pg_is_in_recovery", map[string]interface{}{"sql": pgIsInRecovery,
		"host": cn.config.Host, "port": cn.config.Port, "target_session_attrs": cn.config.targetSessionAttrs})
	inReRows, err := cn.query(pgIsInRecovery, nil)
	defer inReRows.Close()
	var dbTranReadOnly string
	lastCols := []driver.Value{&dbTranReadOnly}
	err = inReRows.Next(lastCols)
	if err != nil {
		cn.log(context.Background(), LogLevelDebug, "err:"+err.Error(), map[string]interface{}{})
		return false, err
	}
	pgIsRecovery := lastCols[0].(bool)
	cn.log(context.Background(), LogLevelDebug, "check pg_is_in_recovery ?", map[string]interface{}{"pg_is_in_recovery": pgIsRecovery,
		"host": cn.config.Host, "port": cn.config.Port})
	if expectedIsRecovery == pgIsRecovery {
		return true, nil
	}
	return false, nil
}

func ValidateConnectTargetSessionAttrsPrimary(cn *conn) error {
	b, err := validateConnectTargetSessionAttrsRecovery(cn, false)
	if err != nil {
		return err
	}
	if !b {
		return errors.New("connection is not primary instance")
	}
	return nil
}

func ValidateConnectTargetSessionAttrsStandby(cn *conn) error {
	b, err := validateConnectTargetSessionAttrsRecovery(cn, true)
	if err != nil {
		return err
	}
	if !b {
		return errors.New("connection is not standby instance")
	}
	return nil
}
