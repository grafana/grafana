# Grafana + k6

This is a collection of libraries and tests for running [k6](https://k6.io) with a Grafana target.
The collection is provided to reduce boilerplate for interacting with Grafana through k6 and can be
used for both testing Grafana under load and for better scoring in Grafana Labs' [bug bounty](https://github.com/grafana/bugbounty).
We recommend copying the lib folder when using this as a library.

> **Note**
> The k6 library for Grafana is highly experimental and does not provide a stable or consistent API.

## Usage

Tests are placed in the _tests/_ directory and use the libraries from _lib/_ to interact with Grafana
where reasonable. Some tests require special environmental variables to be set when running, and will specify
that.

By default, all tests run toward http://localhost:3000 and use the username:password combination `admin:admin`.

Example:

```bash
k6 run tests/users/crud.js
```

### Common environment variables

The Grafana k6 library respects a number of environment variables to allow tweaking of test behavior without modifying the test.
The defaults are expected to work for a local development installation with a fresh SQLite database.

| Environment variable | Default                      | Description                                                 |
|----------------------|------------------------------|-------------------------------------------------------------|
| GT_NEW_USER_PASSWORD | correct horse battery staple | Password for users created during the test                  |
| GT_PASSWORD          | admin                        | Password for a privileged user to use during the test       |
| GT_SCALE             | 1.0                          | Factor to use when provisioning initial resources for tests |
| GT_URL               | http://localhost:3000        | URL of the Grafana instance for which to run the test       |
| GT_USERNAME          | admin                        | Username for a privileged user to use during the test       |

## Writing tests

New tests should be placed in an appropriate subdirectory of the _tests/_ folder and have a descriptive name.
Ideally, your test can be successfully run in a local development environment by running `k6 run tests/<subdir>/<test>.js` and
against a remote Grafana host using `k6 run -e GT_URL=https://grafana.example.org -e GT_USERNAME=admin -e GT_PASSWORD=... tests/<subdir>/<test>.js`.
Much of the Grafana k6 library in _lib/_ has been documented with [JSDoc](https://jsdoc.app). This documentation is not yet available as a webpage.

### Example test

```javascript
import { loginAdmin } from "../../lib/api.js";
import { userAPI } from "../../lib/users.js";

export let options = {
    duration: "1m",
    noCookiesReset: true,
};

export default function (data) {
    loginAdmin();
    const user = userAPI.create(userAPI.skel('k6'));
    userAPI.del(user);
}
```
