# Using this docker image

Uploaded to dockerhub as grafana/grafana-plugin-ci:latest-alpine

Based off of `circleci/node:12-browsers` 

## User
The user will be `circleci`
The home directory will be `/home/circleci`

## Node
- node 12 is installed
- yarn is installed globally
- npm is installed globally

## Go
- Go is installed in `/usr/local/bin/go`
- golangci-lint is installed in `/usr/local/bin/golangci-lint`
- mage is installed in `/home/circleci/go/bin/mage`

All of the above directories are in the path, so there is no need to specify fully qualified paths.

## Grafana
- Installed in `/home/circleci/src/grafana`
- `yarn install` has been run

## Integration/Release Testing
There are 4 previous versions pre-downloaded to /usr/local/grafana. These versions are:
1. 6.6.2
2. 6.5.3
3. 6.4.5
4. 6.3.7

To test, your CircleCI config will need a run section with something similar to the following
```
- run:
        name: Setup Grafana (local install)
        command: |
          sudo dpkg -i /usr/local/grafana/deb/grafana_6.6.2_amd64.deb
          sudo cp ci/grafana-test-env/custom.ini /usr/share/grafana/conf/custom.ini
          sudo cp ci/grafana-test-env/custom.ini /etc/grafana/grafana.ini
          sudo service grafana-server start
          grafana-cli --version
```


# Building
To build, cd to `<srcroot>/packages/grafana-toolkit/docker/grafana-plugin-ci-alpine`
```
./build.sh
```

# Developing/Testing
To test, you should have docker-compose installed.
```
cd test
./start.sh
```

You will be in /home/circleci/test with the buildscripts installed to the local directory.
Do your edits/run tests. When saving, your edits will be available in the container immediately.
