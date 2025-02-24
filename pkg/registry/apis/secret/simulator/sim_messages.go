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
	ctx         context.Context
	tx          contracts.Tx
	secureValue *secretv0alpha1.SecureValue
	cb          func(error)
}

func (simDatabaseAppendQuery) Message() {}

type simDatabaseSecretMetadataHasPendingStatusQuery struct {
	ctx       context.Context
	tx        contracts.Tx
	namespace xkube.Namespace
	name      string
	cb        func(bool, error)
}

func (simDatabaseSecretMetadataHasPendingStatusQuery) Message() {}

type simDatabaseCreateSecureValueMetadataQuery struct {
	ctx context.Context
	tx  contracts.Tx
	sv  *secretv0alpha1.SecureValue
	cb  func(*secretv0alpha1.SecureValue, error)
}

func (simDatabaseCreateSecureValueMetadataQuery) Message() {}

type simDatabaseBeginTxQuery struct {
	ctx  context.Context
	opts *sql.TxOptions
	cb   func(tx contracts.Tx, err error)
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
	cb  func(tx contracts.Tx, err error)
	tx  contracts.Tx
	err error
}

func (simDatabaseBeginTxResponse) Message() {}

type simDatabaseCommit struct {
	tx contracts.Tx
}

func (simDatabaseCommit) Message() {}

type simDatabaseCommitResponse struct {
	err error
}

func (simDatabaseCommitResponse) Message() {}

type simDatabaseRollback struct {
	tx contracts.Tx
}

func (simDatabaseRollback) Message() {}

type simDatabaseRollbackResponse struct {
	err error
}

func (simDatabaseRollbackResponse) Message() {}
