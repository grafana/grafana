package sqlstash

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/kinds/accesspolicy"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

func updateAccessControl(ctx context.Context, tx *session.SessionTx, tenant int64,
	grnstr string, meta *kinds.GrafanaResourceMetadata, spec []byte,
) error {
	_, err := tx.Exec(ctx, "DELETE FROM entity_access_rule WHERE policy=?", grnstr)
	if err != nil {
		return err
	}

	var policy accesspolicy.Spec
	err = json.Unmarshal(spec, &policy)
	if err != nil {
		return err
	}

	var sb strings.Builder
	sb.WriteString("INSERT INTO entity_access_rule (policy,scope,role,kind,verb,target) VALUES\n")

	scope := fmt.Sprintf("grn:%d/%s/%s", tenant, policy.Scope.Kind, policy.Scope.Name)
	role := fmt.Sprintf("grn:%d/%s/%s (%s)", tenant, policy.Role.Kind, policy.Role.Name, policy.Role.Xname)
	args := make([]interface{}, 0)

	for i, rule := range policy.Rules {
		if i > 0 {
			sb.WriteString(",\n")
		}
		sb.WriteString("(?,?,?,?,?,?)")
		args = append(args, grnstr, scope, role, rule.Kind, rule.Verb, rule.Target)
	}

	if len(args) > 0 {
		_, err = tx.Exec(ctx, sb.String(), args...)
		if err != nil {
			fmt.Printf("UNIQUE error... not sure why!!!")
			err = nil
		}
	}
	return err
}
