# New Grafana Release Processes

## Building release packages

1) Update package.json so that it has the right version.
2) Packages from master a built automatically by circle CI for this repo [grafana/grafana-packer](https://github.com/grafana/grafana-packer)

### Non master branch

When building from non master branch create a new branch in repo [grafana/grafana-packer](https://github.com/grafana/grafana-packer)
and configure circle.yml to deploy that branch as well, https://github.com/grafana/grafana-packer/blob/master/circle.yml#L25


