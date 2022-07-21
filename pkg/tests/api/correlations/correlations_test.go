package correlations

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func testScenario(t *testing.T, desc string, fn func(t *testing.T, ctx TestContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		ctx := NewTestEnv(t)
		fn(t, ctx)
	})
}

func TestIntegrationCreateCorrelation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testScenario(t, "Unauthenticated users shouldn't be able to create correlations",
		func(t *testing.T, ctx TestContext) {
			res := ctx.Post(PostParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-ds-uid"),
				body: ``,
			})
			require.Equal(t, 403, res.StatusCode)
		},
	)

	testScenario(t, "non org admin shouldn't be able to create correlations",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_EDITOR),
				Password:       "editor",
				Login:          "editor",
			})

			res := ctx.Post(PostParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-ds-uid"),
				body: ``,
				user: User{
					username: "editor",
					password: "editor",
				},
			})
			require.Equal(t, 403, res.StatusCode)
		},
	)

	testScenario(t, "missing source data source in body should result in a 400",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			res := ctx.Post(PostParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "nonexistent-ds-uid"),
				body: `{}`,
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 400, res.StatusCode)
		},
	)

	testScenario(t, "inexistent source data source should result in a 404",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			res := ctx.Post(PostParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", "nonexistent-ds-uid"),
				body: `{
					"targetUid": "some-ds-uid"
				}`,
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 404, res.StatusCode)
		},
	)

	testScenario(t, "inexistent target data source should result in a 404",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			createDsCommand := &datasources.AddDataSourceCommand{
				Name:  "ds",
				Type:  "loki",
				OrgId: 1,
			}
			ctx.createDs(createDsCommand)

			res := ctx.Post(PostParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", createDsCommand.Result.Uid),
				body: `{
					"targetUid": "some-ds-uid"
				}`,
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 404, res.StatusCode)
		},
	)

	testScenario(t, "creating a correlation originating from a read-only data source should result in a 403",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			createDsCommand := &datasources.AddDataSourceCommand{
				Name:     "ds",
				Type:     "loki",
				ReadOnly: true,
				OrgId:    1,
			}
			ctx.createDs(createDsCommand)

			res := ctx.Post(PostParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", createDsCommand.Result.Uid),
				body: fmt.Sprintf(`{
					"targetUid": "%s"
				}`, createDsCommand.Result.Uid),
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 403, res.StatusCode)
		},
	)

	testScenario(t, "creating a correlation pointing to a read-only data source should work",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			createSourceDsCommand := &datasources.AddDataSourceCommand{
				Name:  "source",
				Type:  "loki",
				OrgId: 1,
			}
			ctx.createDs(createSourceDsCommand)

			createTargetDsCommand := &datasources.AddDataSourceCommand{
				Name:     "target",
				Type:     "loki",
				ReadOnly: true,
				OrgId:    1,
			}
			ctx.createDs(createTargetDsCommand)

			res := ctx.Post(PostParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", createSourceDsCommand.Result.Uid),
				body: fmt.Sprintf(`{
					"targetUid": "%s"
				}`, createTargetDsCommand.Result.Uid),
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 200, res.StatusCode)
		},
	)

	testScenario(t, "Should correctly create a correlation",
		func(t *testing.T, ctx TestContext) {
			ctx.createUser(user.CreateUserCommand{
				DefaultOrgRole: string(models.ROLE_ADMIN),
				Password:       "password",
				Login:          "grafana",
			})

			createDsCommand := &datasources.AddDataSourceCommand{
				Name:  "ds",
				Type:  "loki",
				OrgId: 1,
			}
			ctx.createDs(createDsCommand)

			res := ctx.Post(PostParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", createDsCommand.Result.Uid),
				body: fmt.Sprintf(`{
					"targetUid": "%s"
				}`, createDsCommand.Result.Uid),
				user: User{
					username: "grafana",
					password: "password",
				},
			})

			require.Equal(t, 200, res.StatusCode)
		},
	)
}
