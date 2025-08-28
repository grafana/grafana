# Developer guide

This guide helps you get started developing Grafana.

## Dependencies

Make sure you have the following dependencies installed before setting up your developer environment:

- [Git](https://git-scm.com/)
- [Go](https://golang.org/dl/) (see [go.mod](../go.mod#L3) for minimum required version)
- [Node.js (Long Term Support)](https://nodejs.org), with [corepack enabled](https://nodejs.org/api/corepack.html#enabling-the-feature). See [.nvmrc](../.nvmrc) for supported version. We recommend that you use a version manager such as [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), or similar.
- [GCC](https://gcc.gnu.org/) (required for Cgo] dependencies)

### macOS

We recommend using [Homebrew](https://brew.sh/) for installing any missing dependencies:

```
brew install git
brew install go
brew install node@22
```

### Windows

If you are running Grafana on Windows 10, we recommend installing the Windows Subsystem for Linux (WSL). For installation instructions, refer to our [Grafana setup guide for Windows environment](https://grafana.com/blog/2021/03/03/how-to-set-up-a-grafana-development-environment-on-a-windows-pc-using-wsl/).

## Download Grafana

We recommend using the Git command-line interface to download the source code for the Grafana project:

1. Open a terminal and run `git clone https://github.com/grafana/grafana.git`. This command downloads Grafana to a new `grafana` directory in your current directory.
1. Open the `grafana` directory in your favorite code editor.

For alternative ways of cloning the Grafana repository, refer to [GitHub's documentation](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository).

> **Caution:** Do not use `go get` to download Grafana. Recent versions of Go have added behavior which isn't compatible with the way the Grafana repository is structured.

### Set up yarn

In the repository enable and install yarn via corepack

```
corepack enable
corepack install
```

### Configure precommit hooks

We use pre-commit hooks (via [lefthook](https://github.com/evilmartians/lefthook)) to lint, fix, and format code as you commit your changes. Previously, the Grafana repository automatically installed these hook when you ran `yarn install`, but they are now opt-in for all contributors.

To install the precommit hooks:

```sh
make lefthook-install
```

To remove precommit hooks:

```sh
make lefthook-uninstall
```

> We strongly encourage contributors who work on the frontend to install the precommit hooks, even if your IDE formats on save. By doing so, the `.betterer.results` file is kept in sync.

## Build Grafana

When building Grafana, be aware that it consists of two components:

- The _frontend_, and
- The _backend_.

### Frontend

Before you can build the frontend assets, you need to install the related dependencies:

```
yarn install --immutable
```

> If you get the error `The remote archive doesn't match the expected checksum` for a dependency pulled from a link (for example, `"tether-drop": "https://github.com/torkelo/drop"`): this is a temporary mismatch. To work around the error (while someone corrects the issue), you can prefix your `yarn install --immutable` command with [`YARN_CHECKSUM_BEHAVIOR=update`](https://yarnpkg.com/advanced/error-codes#yn0018---cache_checksum_mismatch).

After the command has finished, you can start building the source code:

```
yarn start
```

This command generates SASS theme files, builds all external plugins, and then builds the frontend assets.

After `yarn start` has built the assets, it will continue to do so whenever any of the files change. This means you don't have to manually build the assets every time you change the code.

> **Troubleshooting:** if your first build works, after pulling updates you may see unexpected errors in the "Type-checking in progress..." stage. These errors can be caused by the [tsbuildinfo cache supporting incremental builds](https://www.typescriptlang.org/tsconfig#incremental). In this case, you can enter `rm tsconfig.tsbuildinfo` and re-try.

#### Plugins

If you want to contribute to any of the plugins listed below (that are found within the `public/app/plugins` directory) they require running additional commands to watch and rebuild them.

- azuremonitor
- cloud-monitoring
- grafana-postgresql-datasource
- grafana-pyroscope-datasource
- grafana-testdata-datasource
- jaeger
- mysql
- parca
- tempo
- zipkin
- loki

To build and watch all these plugins you can run the following command. Note this can be quite resource intensive as it will start separate build processes for each plugin.

```
yarn plugin:build:dev
```

If, instead, you would like to build and watch a specific plugin you can run the following command. Make sure to substitute `<name_of_plugin>` with the plugins name field found in its package.json. e.g. `@grafana-plugins/tempo`.

```
yarn workspace <name_of_plugin> dev
```

If you want to run multiple specific plugins, you can use the following command.

```
yarn nx run-many -t dev --projects="@grafana-plugins/grafana-azure-monitor-datasource,@grafana-plugins/jaeger"
```

If you're unsure of the name of the plugins you'd like to run you can query nx with the following command to get a list of all plugins:

`yarn nx show projects --projects="@grafana-plugins/*"`

Next, we'll explain how to build and run the web server that serves these frontend assets.

### Backend

Build and run the backend by running `make run` in the root directory of the repository. This command compiles the Go source code and starts a web server.

> **Troubleshooting:** Are you having problems with [too many open files](#troubleshooting)?

By default, you can access the web server at `http://localhost:3000/`.

Log in using the default credentials:

| username | password |
| -------- | -------- |
| `admin`  | `admin`  |

When you log in for the first time, Grafana asks you to change your password.

#### Build on Windows

The Grafana backend includes SQLite, a database which requires GCC to compile. So in order to compile Grafana on Windows you need to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download). Eventually, if you use [Scoop](https://scoop.sh), you can install GCC through that.

You can build the back-end as follows:

1. Follow the [instructions](https://github.com/google/wire#installing) to install the Wire tool.
2. Generate code using Wire. For example:

```
# Default Wire tool install path: $GOPATH/bin/wire.exe
<Wire tool install path> gen -tags oss ./pkg/server ./pkg/cmd/grafana-cli/runner
```

3. Build the Grafana binaries:

```
go run build.go build
```

The Grafana binaries will be installed in `bin\\windows-amd64`.

Alternatively, if you are on Windows and want to use the `make` command, install [Make for Windows](http://gnuwin32.sourceforge.net/packages/make.htm) and use it in a UNIX shell (for example, Git Bash).

## Test Grafana

The test suite consists of three types of tests: _Frontend tests_, _backend tests_, and _end-to-end tests_.

### Run frontend tests

We use [Jest](https://jestjs.io/) for our frontend tests. Run them using Yarn:

```
yarn test
```

### Run backend tests

If you're developing for the backend, run the tests with the standard Go tool:

```
go test -v ./pkg/...
```

#### On Windows

Running the backend tests on Windows currently needs some tweaking, so use the `build.go` script:

```
go run build.go test
```

### Run SQLite, PostgreSQL and MySQL integration tests

By default, grafana runs SQLite. To run test with SQLite:

```bash
go test -covermode=atomic -tags=integration ./pkg/...
```

To run PostgreSQL and MySQL integration tests locally, start the Docker blocks for test data sources for MySQL, PostgreSQL, or both, by running `make devenv sources=mysql_tests,postgres_tests`.

When your test data sources are running, you can execute integration tests by running for MySQL:

```bash
make test-go-integration-mysql
```

For PostgreSQL, you could run:

```bash
make test-go-integration-postgres
```

### Run end-to-end tests

- Grafana uses [Playwright](https://playwright.dev/) to run automated end-to-end tests. You can find more information [in our end-to-end testing style guide](./style-guides/e2e-playwright.md#playwright-for-plugins)

- Each version of Playwright needs specific versions of browser binaries to operate. You need to use the Playwright CLI to install these browsers: `yarn playwright install chromium`.
- Run tests with `yarn e2e:playwright [optional path to test file]`.

- To open the last HTML report, you can run `yarn playwright show-report`. You can also open an arbitrary report with `yarn playwright show-report <reportLocation>`. For Grafanistas, the reports are also downloable from CI by:
  - Clicking through to _End-to-end tests_/_All Playwright tests complete_.
  - Clicking _Summary_.
  - Download the _playwright-html-<number>_ artifact.
  - Unzip.
  - Run `yarn playwright show-report <reportLocation>`

If you are curious about other commands, you can see the full list in [the Playwright documentation](https://playwright.dev/docs/test-cli#all-options).

## Configure Grafana for development

The default configuration, `defaults.ini`, is located in the `conf` directory.

To override the default configuration, create a `custom.ini` file in the `conf` directory. You only need to add the options you wish to override.

Enable the development mode by adding the following line in your `custom.ini`:

```
app_mode = development
```

### Add data sources

By now, you should be able to build and test a change you've made to the Grafana source code. In most cases, you'll need to add at least one data source to verify the change.

To set up data sources for your development environment, go to the [devenv](/devenv) directory in the Grafana repository:

```
cd devenv
```

Run the `setup.sh` script to set up a set of data sources and dashboards in your local Grafana instance. The script creates a set of data sources called **gdev-\<type\>**, and a set of dashboards located in a folder called **gdev dashboards**.

Some of the data sources require databases to run in the background.

Installing and configuring databases can be a tricky business. Grafana uses [Docker](https://docker.com) to make the task of setting up databases a little easier. Make sure you [install Docker](https://docs.docker.com/docker-for-mac/install/) before proceeding to the next step.

In the root directory of your Grafana repository, run the following command:

```
make devenv sources=influxdb,loki
```

The script generates a Docker Compose file with the databases you specify as `sources`, and runs them in the background.

See the repository for all the [available data sources](/devenv/docker/blocks). Note that some data sources have specific Docker images for macOS; for example, `nginx_proxy_mac`.

## Build a Docker image

To build a Docker image, run:

```
make build-docker-full
```

The resulting image will be tagged as `grafana/grafana:dev`.

> **Note:** If you use Docker for macOS, be sure to set the memory limit to be larger than 2 GiB. Otherwise, `grunt build` may fail. The memory limit settings are available under **Docker Desktop** -> **Preferences** -> **Advanced**.

## Troubleshooting

Are you having issues with setting up your environment? Here are some tips that might help.

### IDE configuration

Configure your IDE to use the TypeScript version from the Grafana repository. The version should match the TypeScript version in the `package.json` file, and is typically located at `node_modules/.bin/tsc`.

Previously, Grafana used Yarn PnP to install frontend dependencies, which required additional special IDE configuration. This is no longer the case. If you have custom paths in your IDE for ESLint, Prettier, or TypeScript, you can now remove them and use the defaults from `node_modules`.

### Too many open files when running `make run`

Depending on your environment, you may need to increase the maximum number of open files allowed. For the rest of this section, we will assume you are on a UNIX-like OS (for example, Linux or macOS), where you can control the maximum number of open files through the [ulimit](https://ss64.com/bash/ulimit.html) shell command.

To see how many open files are allowed, run:

```
ulimit -a
```

To change the number of open files allowed, run:

```
ulimit -S -n 4096
```

The number of files needed may be different on your environment. To determine the number of open files needed by `make run`, run:

```
find ./conf ./pkg ./public/views | wc -l
```

Another alternative is to limit the files being watched. The directories that are watched for changes are listed in the `.bra.toml` file in the root directory.

You can retain your `ulimit` configuration, that is, save it so it will be remembered for future sessions. To do this, commit it to your command line shell initialization file. Which file this is depends on the shell you are using. For example:

- zsh -> ~/.zshrc
- bash -> ~/.bashrc

Commit your ulimit configuration to your shell initialization file as follows ($LIMIT being your chosen limit and $INIT_FILE being the initialization file for your shell):

```
echo ulimit -S -n $LIMIT >> $INIT_FILE
```

Your command shell should read the initialization file in question every time it gets started, and apply your `ulimit` command.

For some people, typically using the bash shell, ulimit fails with an error similar to the following:

```
ulimit: open files: cannot modify limit: Operation not permitted
```

If that happens to you, chances are you've already set a lower limit and your shell won't let you set a higher one. Try looking in your shell initialization files (`~/.bashrc`, typically), to see if there's already an `ulimit` command that you can tweak.

### System limit for number of file watchers reached while running `yarn start`

Depending on your environment, you may need to increase the number of file watchers allowed by `inotify` package to monitor filesystem changes. You may encounter an error `Error: ENOSPC: System limit for number of file watchers reached` otherwise.

Edit the system config file to insert the new value for file watchers limit:

On Linux:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

On macOS:

```bash
sudo sysctl -w kern.maxfiles=524288
```

Check if the new value was applied. It must output `524288`:

On Linux:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

On macOS:

```bash
sysctl kern.maxfiles
```

### JavaScript heap out of memory while running `yarn start`

Running `yarn start` requires a substantial amount of memory space. You may check the currently allocated heap space to `node` by running the command:

```bash
node -e 'console.log(v8.getHeapStatistics().heap_size_limit/(1024*1024))'
```

Increase the default heap memory to something greater than the currently allocated memory. Make sure the value is a multiple of `1024`.

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

Or on Windows:

```
Set NODE_OPTIONS="--max-old-space-size=8192"
```

### Getting `AggregateError` when building frontend tests

If you encounter an `AggregateError` when building new tests, this is probably due to a call to our client [backend service](https://github.com/grafana/grafana/blob/main/public/app/core/services/backend_srv.ts) not being mocked. Our backend service anticipates multiple responses being returned and was built to return errors as an array. A test encountering errors from the service will group those errors as an `AggregateError` without breaking down the individual errors within. `backend_srv.processRequestError` is called once per error and is a great place to return information on what the individual errors might contain.

### Getting `error reading debug_info: decoding dwarf section line_str at offset` trying to run VSCode debugger

If you are trying to run the server from VS code and get this error, run `go install github.com/go-delve/delve/cmd/dlv@master` in the terminal.

## Next steps

- Read our [style guides](/contribute/style-guides).
- Learn how to [create a pull request](/contribute/create-pull-request.md).
- Read about the [architecture](architecture).
- Read through the [backend documentation](/contribute/backend/README.md).
