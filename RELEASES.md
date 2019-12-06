# Grafana Releases

## Release schedule

Release cadence of first beta-release being cut is 6 weeks.

## Branch management and versioning strategy

We use [Semantic Versioning](https://semver.org/).

We maintain a separate branch for each minor release, named `v<major>.<minor>.x`, e.g. v6.0.x, v6.5.x. The release branch is created from the master branch just before  releasing the first beta-release of a minor version, e.g. v6.5.0-beta1.

New features, bug fixes and changes are squashed and merged into the master branch. Bug fixes needed to be included in a patch release are being cherry-picked from the master branch. The master branch is the development branch.

## Release management roles

### Release coordinator

Responsible for coordinating entire release series of a minor release, meaning all beta- and patch releases of a minor release.

### Release responible

Assigned by release coordinator or voluntarily requested. Responsible for doing the actual work of an individual release.

## Create a new milestone

**What:** Create a milestone to keep track of every issue and PR to be included in a release
**Who:** Release coordinator or any maintainer

## Before the release

**When:** At least a day before the target release date
**What:** Keep track of milestone process to be able to decide/suggest date of release
**Who:** Release coordinator

### Check status of milestone

Every PR that's included in milestone have proper labeling:
- `type/bug` - if the issue it fixes is labeled as a bug
- `cherry-pick needed` - denoting that a PR needs to be cherry-picked to be included in release. Applicable for any release after first beta release, e.g. release branch exists.
- `add to changelog` - if the PR should be added to the changelog.

Any PR merged that haven't been added to the release milestone?

### Decide/suggest date of release

### Assign release responsible

## Prepare the release

**Preconditions:**
  - Date of release decided
  - Release responsible assigned

**When:** At least a day before the target release date
**What:** Prepare everything needed to be ready to draft a new release on the target release date
**Who:** Release coordinator and release responsible(s)

### Update changelog

### First major/minor beta release?

### Any release after first beta release?

#### Cherry pick commits

## Tag a new release

**Who:** Release responsible(s)
**When:** Target release date

See [Grafana Release Guide](https://).

## After the release

**Who:** Release coordinator and release responsible(s)
**When:** Target release date
