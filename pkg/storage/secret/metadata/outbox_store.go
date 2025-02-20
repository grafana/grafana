package metadata

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
)

type outboxStore struct {
	db db.DB
}

type outboxDB struct {
	// ...
	Name      string
	Namespace string
	Secret    string
}

type Message struct {
	ResourceName      string
	ResourceNamespace string
	EncryptedSecret   string
}

// TODO make a contract for what we receive
func (s *outboxStore) Append(ctx context.Context, tx *db.Session, message Message) error {
	outboxDB := &outboxDB{Name: message.ResourceName, Namespace: message.ResourceNamespace, Secret: message.EncryptedSecret}
	_, err := tx.Table("secret_outbox").Insert(outboxDB)
	if err != nil {
		return fmt.Errorf("failed to insert into outbox queue")
	}

	return nil
}
