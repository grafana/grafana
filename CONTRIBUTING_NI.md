# Contributing to NI-maintained fork of Grafana

### Preface

Any changes made to this fork should be considered for upstreaming first. If the change in question can be made in a generic way, we should play our part as good open-source citizens and open a PR to the upstream repository before contributing directly to this fork.

This also means that every contribution to this fork will be highly scrutinized, as we are making a conscious effort to stay as close to the mainline as possible. Any new panels or related functionality should be implemented as plugins to avoid changing the first-class panels and further deviating from the mainline.

### Overview

The default branch of this repository is _main_, which contains both NI-specific changes and changes we intend to upstream. This branch is always based on a stable tagged commit from Grafana's upstream.

Changes that will be upstreamed will also live in separate topic branches prefixed with _ni/pub/_. These branches should be based on the same tag that _main_ is based on, rather than on _main_ itself. This approach has several benefits:

- PRs can be opened on [grafana/grafana](https://github.com/grafana/grafana) using these branches instead of having to cherry pick commits from _main_.
- Prevents us from accidentally making changes that will be upstreamed dependent on private changes.
- Makes it easier to remove changes that were accepted upstream from our mainline.

### How do I...

#### Make a private change to ni/grafana?

To make changes to the fork that are NI-specific, simply create a topic branch based on _main_, make your changes, and then open a pull request merging your topic branch back into _main_. After the changes are reviewed and accepted, the branch should be **squash merged** and then deleted.

#### Make a change that could be accepted upstream?

In an ideal world, we could make changes to [grafana/grafana](https://github.com/grafana/grafana) directly and then integrate them into our fork after they release a new stable version. However, this could take weeks or months. To keep our development cycles short, these changes need to also be merged into our fork in the meantime.

Create a branch prefixed with ni/pub based on the same tag that ni/grafana's main is based on. Example:

```
# Finds the most recent tag reachable from main
git describe --tags --abbrev=0 main
git checkout -b ni/pub/cool-new-feature <latest-tag>
```

Then make your changes on this branch and open a pull request merging it into _main_. If your changes on an ni/pub/_ branch result in merge conflicts with another ni/pub/_ branch, rebase your branch on the conflicting branch and force push. After the changes are reviewed and accepted, the branch should be **squash merged** and **not** deleted.

#### Integrate a new release of Grafana into the fork?

First, pull the latest tags from upstream:

```
git fetch upstream --tags
git push origin --tags
```

Backup the current main branch, so we can revert if necessary:

```
git checkout main && git pull
git checkout -b main-archive-9.0.5 # Version of last rebase
git push -u origin main-archive-9.0.5
```

Back on main, reset the branch to the desired Grafana release tag:

```
git checkout main
git reset --hard v9.0.5
```

Cherry-pick all of our NI-specific commits from the archive branch. The first commit should have the message:

_init ni/grafana fork_.

```
# git cherry-pick X^..Y where X is the first commit and Y is the latest on the archive branch you created above
git cherry-pick 095cea2^..d919979
```

Carefully resolve any merge conflicts. Run `git cherry-pick --skip` for any changes that were accepted upstream since the last version bump.
Once the cherry pick is completed, force push main (`git push -f`). If you are not an admin, ask one to do this step for you.

If you find you need to update `main` multiple times during the same release upgrade process (you may find issues that need resolution after initial attempt), or as part of the cherry-pick process you inadvertently introduced new commits, you can/should collapse those commits into a single commit (the most recent commit) using `git rebase -i (commit before first new commit)`.

### Tips and Tricks

#### Setup

First, make sure to read and follow the directions of the [Developer Guide](./contribute/developer-guide.md). 

#### Windows users

As of Grafana 11, you should be using a later version of node (e.g. 22), as the noted version in the [linked blog](https://grafana.com/blog/2021/03/03/how-to-set-up-a-grafana-development-environment-on-a-windows-pc-using-wsl/) of 14.15.5 will fail to compile the backend and frontend code. Using a newer version of Go (more recent than the noted 1.15) may also be needed (e.g. 1.23).

In Docker Desktop make sure to enable the WSL distribution you intend to use (via Settings->Resources->WSL integration).

#### Compiling/running backend

In Visual Studio Code, you may want to add the WSL extension (Microsoft). In an Ubuntu (or appropriate WSL distro) terminal, you may have to run `make run` for the first compile of the backend (which is a long process). Successive compiles, after you alter either configuration files (like `defaults.ini`, or more appropriately `custom.ini`), or  backend code (e.g. Go files in the `pkg` folder directory) can normally be successful using **`make run-go`**, which is a _much_ faster compile process.

Generally, you will want to use the [**`ni.ini`** configuration file](./conf/ni.ini) when starting the backend, which has settings to enable it to run within the SLE Grafana web app. To do this, you _must_ copy it to a file named **`custom.ini`** in the same directory. This file will be ignored by Github.

#### Compiling/running frontend

Instead of using `yarn start` as the blog indicates, you can likely start with just using **`yarn start:noLint`** which avoids both the linting and type-checking process. This is a substantially faster compile process than using `yarn start`.

