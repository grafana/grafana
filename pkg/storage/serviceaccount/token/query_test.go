package token

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTokenQueries(t *testing.T) {
	expires := int64(1735693200)
	revoked := false
	row := &Token{
		ID:                 "83f63f4c-a28b-4378-87cc-77e2b552ecbf",
		Namespace:          "org-1",
		Name:               "deploy",
		Key:                "hashed-key",
		Created:            time.Unix(1735689600, 0).UTC(),
		Updated:            time.Unix(1735689600, 0).UTC(),
		ServiceAccountName: "sa-one",
		IsRevoked:          &revoked,
		Expires:            &expires,
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlTokenCreate: {
				{
					Name: "create",
					Data: &createToken{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row:         row,
						IsRevoked:   false,
					},
				},
			},
			sqlTokenGetByName: {
				{
					Name: "get_by_name",
					Data: &getTokenByName{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Query: &GetByNameQuery{
							Namespace:          "org-1",
							ServiceAccountName: "sa-one",
							Name:               "deploy",
						},
					},
				},
			},
			sqlTokenGetByHash: {
				{
					Name: "get_by_hash",
					Data: &getTokenByHash{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Hash:        "hashed-key",
					},
				},
			},
			sqlTokenUpdateLastUsed: {
				{
					Name: "update_last_used",
					Data: &updateTokenLastUsed{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						ID:          row.ID,
						LastUsedAt:  time.Unix(1735689900, 0).UTC(),
					},
				},
			},
			sqlTokenDelete: {
				{
					Name: "delete",
					Data: &deleteToken{
						SQLTemplate:        mocks.NewTestingSQLTemplate(),
						Namespace:          "org-1",
						ServiceAccountName: "sa-one",
						Name:               "deploy",
					},
				},
			},
			sqlTokenListBySA: {
				{
					Name: "list",
					Data: &listTokensByServiceAccount{
						SQLTemplate:        mocks.NewTestingSQLTemplate(),
						Namespace:          "org-1",
						ServiceAccountName: "sa-one",
						Limit:              3,
						Offset:             2,
					},
				},
			},
		},
	})
}
