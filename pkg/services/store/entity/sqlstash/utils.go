package sqlstash

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/store"
)

func createContentsHash(body []byte, meta []byte, status []byte) string {
	h := md5.New()
	_, _ = h.Write(meta)
	_, _ = h.Write(body)
	_, _ = h.Write(status)
	hash := h.Sum(nil)
	return hex.EncodeToString(hash[:])
}

func getCurrentUser(ctx context.Context) (string, error) {
	modifier, err := appcontext.User(ctx)
	if err != nil {
		return "", fmt.Errorf("get user from ctx: %w", err)
	}

	if modifier == nil {
		return "", ErrUserNotFoundInContext
	}

	username := store.GetUserIDString(modifier)
	if username == "" {
		return "", ErrUserNotFoundInContext
	}

	return username, nil
}

func sliceOr[S ~[]E, E comparable](vals ...S) S {
	for _, s := range vals {
		if len(s) > 0 {
			return s
		}
	}

	return S{}
}

func mapOr[M ~map[K]V, K comparable, V any](vals ...M) M {
	for _, m := range vals {
		if len(m) > 0 {
			return m
		}
	}

	return M{}
}
