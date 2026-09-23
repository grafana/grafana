# Modowners

## Intro

Modowners is a way to ensure that each Go dependency has at least one team responsible for maintaining and upgrading it.

The Backend Code Checks workflow runs `modowners check`. It fails if a direct dependency has no owner. When adding a new dependency, add the responsible team in a line comment.

Pull requests that change `go.mod` get review requests for the teams on the changed require lines. That is the `reviewers` command, run by `.github/workflows/modowners-reviewers.yml`. GitHub CODEOWNERS does not own `go.mod`.

### Example of ownership assignment

`cloud.google.com/go/storage v1.30.1 // @grafana/grafana-backend-group`

## Utilities

### `check`

Validate `go.mod` and exit with an error if a dependency does not have an owner.

Example CLI command:

`go run scripts/modowners/modowners.go check go.mod`

If `go.mod` is valid, there will be no output.

### `owners`

List owners of given dependency.

Example CLI command to get a list of all owners with a count of the number of dependencies they own:

`go run scripts/modowners/modowners.go owners -a -c go.mod`

Example output:

```
@grafana/grafana-backend-services-squad 5
@grafana/grafana-bi-squad 2
@grafana/grafana-app-platform-squad 13
@grafana/observability-metrics 4
@grafana/observability-traces-and-profiling 6
@grafana/alerting-squad-backend 22
@grafana/grafana-catalog 7
@grafana/grafana-operator-experience-squad 3
@grafana/dataviz-squad 1
@grafana/grafana-backend-group 75
@grafana/grafana-as-code 11
@grafana/identity-access-team 6
@grafana/data-sources-plugins 6
```

Example CLI command to get the owner for a specific dependency (you must use `dependency@version`, not `dependency version`):

`go run scripts/modowners/modowners.go owners -d cloud.google.com/go/storage@v1.30.1 go.mod`

Example output:

```
@grafana/grafana-backend-group
```

### `reviewers`

Print GitHub team slugs that should review a `go.mod` diff. Compares two files and prints one slug per line. Indirect requires are ignored. Owners must be `@grafana/<team-slug>`.

Example CLI command:

`go run scripts/modowners/modowners.go reviewers go.mod.base go.mod`

Example output:

```
alerting-backend
grafana-backend-services-squad
```

### `module`

List all dependencies of given owner(s).

Example CLI command to list all direct dependencies owned by Backend Services and Authnz:

`go run scripts/modowners/modowners.go modules -o @grafana/grafana-backend-services-squad,@grafana/identity-access-team go.mod`

Example output:

```
github.com/BurntSushi/toml@v1.2.1
github.com/go-ldap/ldap/v3@v3.4.4
github.com/magefile/mage@v1.14.0
golang.org/x/oauth2@v0.8.0
github.com/drone/drone-cli@v1.6.1
github.com/google/go-github/v45@v45.2.0
github.com/Masterminds/semver/v3@v3.1.1
gopkg.in/square/go-jose.v2@v2.6.0
filippo.io/age@v1.1.1
```

## Action items

For existing dependencies, please review and update ownership of your team’s dependencies in `go.mod`.

- If any assignments are incorrect, you can replace your team name with the correct team in `go.mod`.
- If you don’t know who the correct team is, you can reassign the dependency to `@grafana/grafana-backend-group`. The reviewers workflow will request that team.
