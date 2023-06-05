# Making changes to the Drone pipeline

_Only people in the Grafana organization can make changes to the Drone pipeline_

The Drone pipelines are built with [Starlark](https://github.com/bazelbuild/starlark), a language which is similar to Python. The Starlark files are located in [`scripts/drone`](https://github.com/grafana/grafana/tree/main/scripts/drone).

## Setup

- Set environment variables `DRONE_SERVER` and `DRONE_TOKEN`, which can be found on your [Drone account](https://drone.grafana.net/account). These are used to verify that only Grafana employees can make changes to the pipelines.
- Install [buildifier](https://github.com/bazelbuild/buildtools/blob/master/buildifier/README.md), and use it to format the Starlark files you edit.

## Develop

- Open a PR where you can do test runs for your changes. If you need to experiment with secrets, create a PR in the [grafana-ci-sandbox repo](https://github.com/grafana/grafana-ci-sandbox), before opening a PR in the main repo.
- Run `make drone` after making changes to the Starlark files. This builds the `.drone.yml` file.

For further questions, reach out to the grafana-delivery squad.
