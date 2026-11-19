# Cross-version compatibility tests

Two Grafana versions can run against the same storage at the same time, for example during a rolling deployment or after a rollback.
The tests in this directory check that data written by one version survives being read and rewritten by the other.

Each package has three tests, run as separate phases on one database:

- `TestCompatSetup` runs on version A and creates the fixtures.
- `TestCompatUpdate` runs on version B: it reads the fixtures and rewrites them.
- `TestCompatVerify` runs on version A again: it checks that its data survived B's rewrite, then deletes everything.

CI runs two round trips, each on a fresh database:

1. Older, newer, older: an upgrade followed by a rollback.
2. Newer, older, newer: a rollback followed by a re-upgrade.

In CI, `.github/workflows/pr-test-compat.yml` (with `run-compat-tests.yml`) runs this commit against the newest release of the previous minor, starting with 13.4.
Until that release exists, it runs this commit against itself.
It runs the Enterprise build (`-tags=enterprise`) for internal pull requests and `main`, and the OSS build for pull requests from forks, which cannot clone grafana-enterprise.
For Enterprise, this commit pairs with the grafana-enterprise branch of the same name, or main, and the older release pairs with the grafana-enterprise tag of the same name.
Each version runs the tests it ships with, so a change here reaches the older side only through a release that contains it.
A package only the newer version ships runs against the newer version alone, on its own database, until a release that contains it is the older version.
The job summary lists the commits that were tested and whether the run was really cross-version.
When a phase fails, the job uploads the test logs, the manifests the phases hand to each other, and the SQLite databases as the `compat-<edition>` artifact, kept for 7 days.

## Smoke tests: every resource, no code needed

`smoke/` discovers every namespaced `*.grafana.app` resource with create, get, list, update, and delete, and checks one object per resource:

- Setup creates it.
- Update reads it in every version B serves, then updates and patches it in B's preferred version; stale writes must be rejected.
- Verify reads it in every version A serves, checks that A's values and B's metadata survived, then deletes it and checks it is gone.

Reads also fail when the server reports a failed conversion in `status.conversion`.
The newer version must keep serving every resource and API version the older one wrote.

By default the object is `{"spec": {}}`.
If your resource needs more, the test fails on the PR that adds it and asks for one of these:

- a fixture in `smoke/testdata/<group>/<resource>.yaml`, in any served version; annotate it with `compat.grafana.app/server-named: "true"` if the server derives the name, or
- an entry in `smoke/skip.yaml`, which also covers feature flags, legacy storage, and stale writes; its header explains each section.

A failing smoke test logs the owners of the fixtures in `smoke/testdata/<group>/` when that directory has its own CODEOWNERS entry.
Without one, failures go to the owners of `apps/<app>/`, or of `pkg/apps/<app>/` or `pkg/registry/<app>/` in grafana-enterprise for an Enterprise app, else to the owners of this directory.

Each version follows its own `skip.yaml`, and stale entries fail the test, so the list shrinks as resources move on.

## Deep tests: one package per resource

The smoke test cannot check field values or behavior across several objects.
For that, add a package next to `folders/` and give it a CODEOWNERS entry.
`folders/` builds a small tree, has the other version move folders through both the k8s and the legacy API, and checks nesting in every served version, the `parents`, `children` (with paging), `counts`, `access`, and `status` subresources, folder permissions, list pagination and label selectors, and deleting a non-empty subtree.
Copy it as a starting point.
The package needs:

- a `TestMain` that calls `compat.Main(m)`,
- `TestCompatSetup`, `TestCompatUpdate`, and `TestCompatVerify`, each starting Grafana with `compat.NewHelper(t)`,
- `compat.Served(t, h)` to find the versions the running server serves.

Fixture names and values are a contract with older versions, because those versions keep verifying them as they were written.
Only add fixtures.
Change or remove a fixture only together with the older versions that check it.

## Running locally

Check out the older version next to this one, then run the phases the workflow runs, for the packages both checkouts ship.
For the upgrade-then-rollback round trip:

```sh
git worktree add ../grafana-old <older-ref>
pkgs=(); for d in pkg/tests/compat/*/; do [ -d "../grafana-old/$d" ] && pkgs+=("./$d"); done
export GRAFANA_COMPAT_DIR=$(mktemp -d)/upgrade-rollback
(cd ../grafana-old && GRAFANA_COMPAT_ROLE=older go test -count=1 -run '^TestCompatSetup$' "${pkgs[@]}")
GRAFANA_COMPAT_ROLE=newer go test -count=1 -run '^TestCompatUpdate$' "${pkgs[@]}"
(cd ../grafana-old && GRAFANA_COMPAT_ROLE=older go test -count=1 -run '^TestCompatVerify$' "${pkgs[@]}")
```

For rollback then re-upgrade, swap the directories.
For Enterprise, overlay grafana-enterprise onto both checkouts with its `build.sh` and set `GOFLAGS=-tags=enterprise`.

A failing test logs its owners from CODEOWNERS, and in GitHub Actions also lists them in the job summary, with the version and the round trip it ran in.
A phase that is about to hit the test timeout lists the owners of its package.
Update and Verify change and delete the data, so each round trip needs a new `GRAFANA_COMPAT_DIR`.
Without `GRAFANA_COMPAT_DIR` every test skips, so these tests never run as part of the unit or integration suites.
Only SQLite is supported for now.
