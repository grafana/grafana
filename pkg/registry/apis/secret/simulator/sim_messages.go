package simulator

import (
	"context"
	"database/sql"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type Message interface {
	Message()
}

/*** Request ***/
type simDatabaseAppendQuery struct {
	ctx context.Context
	tx  contracts.TransactionManager
	foo any
	cb  func(error)
}

func (simDatabaseAppendQuery) Message() {}

type simDatabaseSecretMetadataHasPendingStatusQuery struct {
	ctx       context.Context
	tx        contracts.TransactionManager
	namespace xkube.Namespace
	name      string
	cb        func(bool, error)
}

func (simDatabaseSecretMetadataHasPendingStatusQuery) Message() {}

type simDatabaseCreateSecureValueMetadataQuery struct {
	ctx context.Context
	tx  contracts.TransactionManager
	sv  *secretv0alpha1.SecureValue
	cb  func(*secretv0alpha1.SecureValue, error)
}

func (simDatabaseCreateSecureValueMetadataQuery) Message() {}

type simDatabaseBeginTxQuery struct {
	ctx  context.Context
	opts *sql.TxOptions
	cb   func(*sql.Tx, error)
}

func (simDatabaseBeginTxQuery) Message() {}

/*** Response ***/
type simDatabaseAppendResponse struct {
	cb  func(error)
	err error
}

func (simDatabaseAppendResponse) Message() {}

type simDatabaseSecretMetadataHasPendingStatusResponse struct {
	cb        func(bool, error)
	isPending bool
	err       error
}

func (simDatabaseSecretMetadataHasPendingStatusResponse) Message() {}

type simDatabaseCreateSecureValueMetadataResponse struct {
	cb  func(*secretv0alpha1.SecureValue, error)
	sv  *secretv0alpha1.SecureValue
	err error
}

func (simDatabaseCreateSecureValueMetadataResponse) Message() {}

type simDatabaseBeginTxResponse struct {
	cb  func(*sql.Tx, error)
	tx  *sql.Tx
	err error
}

func (simDatabaseBeginTxResponse) Message() {}
