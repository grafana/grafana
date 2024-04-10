# Making changes to the Drone pipeline

{{% admonition type="note" %}}
Only members of the Grafana Organization can make changes to the Drone pipeline.
{{% /admonition %}}

The Drone pipelines are built with [Starlark](https://github.com/bazelbuild/starlark), a similar language to Python. The Starlark files are located in [`scripts/drone`](https://github.com/grafana/grafana/tree/main/scripts/drone).

## Drone setup

1. Set environment variables `DRONE_SERVER` and `DRONE_TOKEN` found in your [Drone account](https://drone.grafana.net/account). These environment variables are used to verify that only Grafana employees can make changes to the pipelines.
1. Install [buildifier](https://github.com/bazelbuild/buildtools/blob/master/buildifier/README.md), and use it to format the Starlark files you want to edit.

## Drone development

1. Open a pull request where you can do test runs for your changes. If you need to experiment with secrets, create a pull request in the [`grafana-ci-sandbox repo`](https://github.com/grafana/grafana-ci-sandbox) before opening a pull request in the main repo.
1. Run `make drone` after making changes to the Starlark files. This builds the `.drone.yml` file.

For further questions, reach out to the `grafana-release-guild` squad.
