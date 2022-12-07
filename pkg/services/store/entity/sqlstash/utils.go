package sqlstash

import (
	"context"
	"crypto/md5"
	"encoding/hex"

	"github.com/grafana/grafana/pkg/services/mtctx"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

type SessionDBProvider = func(ctx context.Context) *session.SessionDB

func GetStaticSessionDBProvider(root *session.SessionDB) SessionDBProvider {
	return func(ctx context.Context) *session.SessionDB {
		return root
	}
}

func GetSessionDBProviderFromContext(root *session.SessionDB) SessionDBProvider {
	return func(ctx context.Context) *session.SessionDB {
		info, err := mtctx.TenantInfoFromContext(ctx)
		if err == nil {
			return info.GetSessionDB()
		}
		return root
	}
}
