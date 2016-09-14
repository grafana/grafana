# New Grafana Release Processes

## Building release packages

1) Update package.json so that it has the right version.
2) Create a git tag for the release: `git tag -a v3.0.4 -m "3.0.4 release"`
3) Push branch & tag to github!
2) Packages from master a built automatically by circle CI for this repo [grafana/grafana-packer](https://github.com/grafana/grafana-packer)

### Non master branch

When building from non master branch create a new branch in repo [grafana/grafana-packer](https://github.com/grafana/grafana-packer)
and configure circle.yml to deploy that branch as well, https://github.com/grafana/grafana-packer/blob/master/circle.yml#L25,
you also need to update https://github.com/grafana/grafana-packer/blob/v3.1.x/deploy.sh#L7.

### Windows build

Sign into ci.appveyor.com and the Grafana project's build history page. Builds for windows take a long time (around 20min)
and fail quite often for random reasons so I usually continue with the release process without a windows build already built.

1) Click on the green build that has the correct version and tag
2) Click on `DEPLOYMENTS`
3) Click on `NEW DEPLOYMENT`
4) Select GrafanaBuildS3
4) Select the build you want to deploy.

The deployment should be quick (just uploads the release zip file to S3)


