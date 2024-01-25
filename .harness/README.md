# Run Vagrant Ruby tests on Harness CI

This is a fork of [grafana/grafana](https://github.com/grafana/grafana/). This project can be used to demonstrate [Docker Layer Caching in Harness](https://developer.harness.io/docs/continuous-integration/use-ci/caching-ci-data/docker-layer-caching/) CI pipelines.

This repository contains over 5,000 Ruby rspec tests. Follow these steps to experiment with Ruby Test Intelligence in your [Harness](https://www.harness.io/) account.

## Setting up this pipeline on Harness CI Hosted Builds

1. Create a [GitHub Account](https://github.com) or use an existing account

2. Fork [this repository](https://github.com/harness-community/grafana/fork) into your GitHub account

3.
    a. If you are new to Harness CI, signup for [Harness CI](https://app.harness.io/auth/#/signup)
      * Select the `Continuous Integration` module and choose the `Starter pipeline` wizard to create your first pipeline using the forked repo from #2.
      * Go to the newly created pipeline and hit the `Triggers`tab. If everything went well, you should see two triggers auto-created. A `Pull Request`trigger and a `Push` trigger. For this exercise, we only need `Push`trigger to be enabled. So, please disable or delete the `Pull Request`trigger.
   
    b. If you are an existing Harness CI user, create a new pipeline to use the cloud option for infrastructure and setup the push trigger.

4. Check the [Docker Layer Caching documentation](https://developer.harness.io/docs/continuous-integration/use-ci/caching-ci-data/docker-layer-caching/) to learn how to enable the feature in your Harness account, 

5. Insert this YAML into your pipeline's `stages` section.

```yaml
    - stage:
        identifier: Build
        type: CI
        name: Build
        description: ""
        spec:
          cloneCodebase: true
          platform:
            os: Linux
            arch: Amd64
          runtime:
            type: Cloud
            spec: {}
          execution:
            steps:
              - step:
                  identifier: Docker_Build
                  type: BuildAndPushDockerRegistry
                  name: Docker Build
                  spec:
                    connectorRef: YOUR_DOCKER_REGISTRY_CONNECTOR
                    repo: YOUR_NAMESPACE/grafana
                    tags:
                      - latest
                      - <+codebase.shortCommitSha>
                    caching: true
```

Replace `YOUR_DOCKER_REGISTRY_CONNECTOR` with your [Docker connector](https://developer.harness.io/docs/platform/connectors/cloud-providers/ref-cloud-providers/docker-registry-connector-settings-reference/) ID.

Replace `YOUR_NAMESPACE` with your namespace (usually your Docker Hub username).

6. Save your changes and run your pipeline by selecting __Run__. This initial pipeline execution must build and push all Docker layers to the cache, it will complete in about seven minutes.

7. Confirm that the Grafana Docker image was published to your Docker registry with two tags (`latest` as well as the short commit SHA).

8. Add a comment to [packaging/docker/run.sh](../packaging/docker/run.sh) in the `main` branch and push your change, this will trigger your pipeline in Harness CI. This time, only the last few layers of the Docker image will be rebuilt, all other layers will be pulled from the cache. The pipeline will complete in about thirty seconds.