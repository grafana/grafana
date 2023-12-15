# Upgrading Go Version

Notes on upgrading Go version.

Example PR: https://github.com/grafana/grafana/pull/79329

## The main areas that need to change during the upgrade are:

- https://github.com/grafana/grafana/blob/d8ecea4ed93efb2e4d64a5ee24bc08f3805f413d/scripts/drone/variables.star#L6
- https://github.com/grafana/grafana/blob/d8ecea4ed93efb2e4d64a5ee24bc08f3805f413d/Makefile#L264
- https://github.com/grafana/grafana/blob/d8ecea4ed93efb2e4d64a5ee24bc08f3805f413d/Dockerfile#L6

Make sure to run `make drone` so that changes to `.star` files are reflected and `drone.yml` is generated.

### Additional files to change

- Take a look in `.github/workflows` folder for what `go` version is being used there in various workflows.
- Make sure to create a PR with the corresponding changes in `grafana/grafana-enterprise` repository.

## Updating the go.mod file

Please avoid updating the `go.mod` to the newest version unless really necessary. This ensures backwards compatibility and introduces less breaking changes. Always upgrade Go version in the runtime files above first, let them run for a couple of weeks and only then consider updating the `go.mod` file if necessary.
