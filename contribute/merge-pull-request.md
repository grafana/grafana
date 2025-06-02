# Merge a pull request

When a pull request has been reviewed and approved by at least one person and all checks have passed, then it's time to merge the pull request.

## Who is expected to merge a pull request?

Maintainers are responsible for merging all pull requests. If a maintainer has opened a pull request, then the general rule is that the same maintainer merges the pull request. If a non-maintainer has opened a pull request, then it's suggested that one of the maintainers who reviews the pull request should merge the pull request.

## Checklist of considerations

Consider (and ask about) the items on the following checklist before merging a pull request:

- Is it reviewed and approved?
- Have all checks passed?
- Does it have a proper pull request title?
- Does it need to be added to the changelog (release notes)?
- Does it need backporting?

## Before merge

Before actually merging a pull request, consider the following things:

### Status checks

Before you can merge a pull request, it must have a review approval, and all the required status checks must pass.

### Format the pull request title

The pull request title should be formatted according to `<Area>: <Summary>` (Both "Area" and "Summary" should start with a capital letter).

Keep the summary short and understandable for the community as a whole.

All commits in a pull request are squashed when merged and the pull request title will be the default subject line of the squashed commit message. It's also used for the [changelog](#what-to-include-in-changelog-and-release-notes).

**Example:**

`Docs: Change url to URL in all documentation files`

See [formatting guidelines](create-pull-request.md#formatting-guidelines) for more information.

### Assign a milestone (automated)

The Grafana release process uses a bot to automatically assign pull requests to a milestone to make it easier for release managers to track changes. For example, [generating changelog (release note)](#what-to-include-in-changelog-and-release-notes) must be in a milestone.

That being said, _you don't have to assign a milestone manually_ to a pull request. Instead, when it is merged and closed, a bot will then look for the most appropriate milestone and assign it to the pull request.

The bot-assigned milestone should always reflect the branch into which the pull request is merged. For example:

- For every major and minor release, there is a milestone ending with `.x` (for example, `10.0.x` for the 10.0.x releases).
- Pull requests targeting `main` use the `.x` milestone of the next minor (or major) version (you can find that version number inside the `package.json` file).
- Backport pull requests use the version of the target branch (for example, `9.4.x` for the `v9.4.x` branch).

### What to include in changelog and release notes

At Grafana we generate the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) and [release notes](https://grafana.com/docs/grafana/latest/release-notes/) based on merged pull requests. Including changes in the changelog (release notes) is very important to provide a relatively complete picture of what changes a Grafana release actually includes.

There's a GitHub action available in the repository named [Update changelog](https://github.com/grafana/grafana/blob/main/.github/workflows/update-changelog.yml) that can be triggered manually to re-generate the changelog and release notes for any release.

Exactly what changes should be added to the changelog is hard to answer but here's some general guidance:

- Include any bug fix in general.
- Include any change that you think would be interesting for the community as a whole.
- Skip larger features divided into multiple pull requests since they might go into the release's What's New article.
- Use your best judgement and, if you aren't sure, then ask other maintainers for advice.
- It's better to err on the side of inclusion. Introducing an unnecessary or duplicate change in the changelog is better than leaving out a change.
- Always keep the guidelines in [Format the pull request title](#format-the-pull-request-title) in mind.

An active decision to include a change in the changelog needs to be taken for every pull request. There's a pull request check named **Changelog Check** that enforces this rule. By adding or removing labels on the pull request or updating the pull request title, description, or both, the check is re-evaluated.

#### Skip changelog

If you don't want to include your change in changelog, you need to add a label named **no-changelog** to the pull request.

#### Include in changelog

To include a pull request in the changelog, add a label named `add to changelog` to the pull request. Then the following additional validation rules are checked:

- The title must be formatted according to [Format the pull request title](#format-the-pull-request-title)
- The description must include a breaking change notice if the change is labeled to be a breaking change. Refer to [Breaking changes](#breaking-changes) below for more information.

Not complying with above rules can make the **Changelog Check** fail with validation errors.

The changelog is divided into various sections. Here's how to make a description of a pull request show up in a certain section of the release notes:

**Features and enhancements:**

Label the pull request with `add to changelog` and any of the other section rules don't apply.

**Bug fixes:**

Label the pull request with `add to changelog` and either label with `type/bug` or the pull request title contains `fix` or `fixes`.

**Plugin development fixes and changes:**

Label the pull request with `area/grafana/ui` or `area/grafana/runtime`.

**Deprecations:**

In case the pull request introduces a deprecation you should document this. Label the pull request with `add to changelog` and use the following template at the end of the pull request description to describe the deprecation change.

```md
# Deprecation notice

<Deprecation description>
```

**Breaking changes:**<a name="breaking-changes"></a>

In case the pull request introduces a breaking change you should document this. Label the pull request with `add to changelog` and `breaking change` and use the following template at the end of the pull request description describing the breaking change:

```md
# Release notice breaking change

<Breaking change description>
```

### Backporting

Backporting is the process of copying the pull request into the version branch of one or multiple previous releases.

Backporting should be a rare exception, reserved only for critical bug fixes, and must be initiated by a Grafana Labs employee. We generally avoid automatic backports, as these changes carry some risk: they typically receive less manual testing than changes included in regular point releases.

If a pull request addresses a critical bug and backporting is warranted, a Grafana Labs team member can apply the appropriate `backport vx.x` labels for the relevant release branches. The team will review and approve the backport before proceeding. When the pull request is merged, seperate backport PRs will automatically be creataed.

#### Required labels

We aim to ensure that we don't backport pull requests unnecessarily. The only scenarios for backporting are typically pull requests that address bugs, have a product approval, or refer to documentation changes.

Backport labels need to be followed by either:

- `type/bug` label: Pull requests which address bugs
- `product-approved` label: Urgent fixes which need product approval, in order to get merged
- `type/docs` label: Docs changes
- `type/ci` label: Changes to the CI automation

> **Note:** You can still backport a pull request after it's been merged.

## Doing the actual merge

The best time to actually merge the pull request varies from case to case. All commits in a pull request are squashed.

You can change the commit message before merging. Please remember that developers might use the commit information for tasks like reviewing changes of files, doing Git blame, and resolving merge conflicts.

While there aren't formal best practices around this process, you can consider the following guidance:

**Do:**

- Make sure the pull request title is formatted properly before merging. Doing so automatically gives you a good and short summary of the commit.
- Leave `Co-authored-by:` lines as is so that co-authors are credited for the contribution.
- Remove any commit information that doesn't bring any context to the change.

**Consider:**

- Keep any references to issues that the pull request fixes, closes, or references. Doing this allows cross-reference between the commit and referenced issue or issues.

To finalize the merge, click the **Confirm squash and merge** button.

## After the merge

Make sure to close any referenced or related issues. We recommend that you assign the same milestone on the issues that the pull request fixes or closes, but this isn't required.
