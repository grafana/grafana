# Modowners

## Intro

Modowners is a way to ensure that each Go dependency has at least one team responsible for maintaining and upgrading it.

The `validate-modfile` drone step checks `go.mod` and will pass if every dependency has an owner. When adding a new dependency, add the responsible team in a line comment.

Currently `validate-modfile` is non-blocking, but will eventually become a blocking step. All newly added dependencies will require an assigned owner.

### Example of ownership assignment

`cloud.google.com/go/storage v1.30.1 // @grafana/backend-platform`

## Utilities

### `check`

Validate `go.mod` and exit with an error if a dependency does not have an owner.

Example CLI command: `go run scripts/modowners/modowners.go check go.mod`

### `owners`

List owners of given dependency.

Example CLI command to get a list of all owners with a count of the number of dependencies they own: `go run scripts/modowners/modowners.go owners -a -c go.mod`

Example CLI command to get the owner for a specific dependency (you must use `dependency@version`, not `dependency version`): `go run scripts/modowners/modowners.go owners -d cloud.google.com/go/storage@v1.30.1 go.mod`

### `module`

List all dependencies of given owner(s).

Example CLI command to list all direct dependencies owned by Delivery and Authnz: `go run scripts/modowners/modowners.go modules -o @grafana/grafana-delivery,@grafana/grafana-authnz-team go.mod`
