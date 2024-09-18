# Upgrading Go Version

Notes on upgrading Go version.

Example PR: https://github.com/grafana/grafana/pull/79329

## The main areas that need to change during the upgrade are:

- [`go.mod`](/go.mod#L3)
- [`go.work`](/go.work#L1)
- [`scripts/drone/variables.star`](/scripts/drone/variables.star#L6)
- [`Makefile`](/Makefile#L12)
- [`Dockerfile`](/Dockerfile#L6)

Then, run `go mod tidy` and `go work sync`. Also run `make drone` so changes to `.star` files are reflected and `drone.yml` is updated.

### Additional files to change

- Take a look in `.github/workflows` folder for what `go` version is being used there in various workflows.
- Make sure to create a PR with the corresponding changes in `grafana/grafana-enterprise` repository.
