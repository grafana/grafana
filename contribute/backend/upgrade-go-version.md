# Upgrade Go version

We recommend the practices outlined in this documentation when you upgrade Go for use in Grafana development.

## Example PR

Refer to the following PR for an example of how to perform a Go upgrade:

- [PR ##79329](https://github.com/grafana/grafana/pull/79329)

## Main areas to update

Change at least the following parts of Go and related files:

- [`go.mod`](/go.mod#L3)
- [`go.work`](/go.work#L1)
- [`scripts/drone/variables.star`](/scripts/drone/variables.star#L6)
- [`Makefile`](/Makefile#L12)
- [`Dockerfile`](/Dockerfile#L6)

Then, run `go mod tidy` and `go work sync`. Also, run `make drone` so changes reflect the updates to `.star` and `drone.yml` files.

### Additional files to change

- Look in the `.github/workflows` folder for what Go version is being used there in various workflows.
- Make sure to create a PR with the corresponding changes in the `grafana/grafana-enterprise` repository.
