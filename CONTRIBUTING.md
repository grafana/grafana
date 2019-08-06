# Contributing

Grafana uses GitHub to manage contributions.
Contributions take the form of pull requests that will be reviewed by the core team.

- If you are a new contributor see: [Steps to Contribute](#steps-to-contribute)

- If you have a trivial fix or improvement, go ahead and create a pull request.

- If you plan to do something more involved, discuss your idea on the respective [issue](https://github.com/grafana/grafana/issues) or create a [new issue](https://github.com/grafana/grafana/issues/new) if it does not exist. This will avoid unnecessary work and surely give you and us a good deal of inspiration.

- Sign our [CLA](http://docs.grafana.org/contribute/cla/).

- Make sure to follow the code style guides
  - [Backend](https://github.com/grafana/grafana/tree/master/pkg)
  - [Frontend](https://github.com/grafana/grafana/tree/master/style_guides)

## Steps to Contribute

Should you wish to work on a GitHub issue, check first if it is not already assigned to someone. If it is free, you claim it by commenting on the issue that you want to work on it. This is to prevent duplicated efforts from contributors on the same issue.

Please check the [`beginner friendly`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) and [`help wanted`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) labels to find issues that are good for getting started. If you have questions about one of the issues, with or without the tag, please comment on them and one of the core team or the original poster will clarify it.

To setup a local development environment we recommend reading [Building Grafana from source](http://docs.grafana.org/project/building_from_source/)

## Pull Request Checklist

- Branch from the master branch and, if needed, rebase to the current master branch before submitting your pull request. If it doesn't merge cleanly with master you may be asked to rebase your changes.

- If your patch is not getting reviewed or you need a specific person to review it, you can @-reply a reviewer asking for a review in the pull request or a comment.

- Add tests relevant to the fixed bug or new feature.

- Follow [PR and commit messages guidelines](#PR-and-commit-messages-guidelines)

### Pull Requests titles and message

Pull request titles should follow this format: `Area: Name of the change`.
Titles are used to generate the changelog so they should be as descriptive as possible in one line.

Good Examples

- `Explore: Adds Live option for supported datasources`
- `GraphPanel: Don't sort series when legend table & sort column is not visible`
- `Build: Support publishing MSI to grafana.com`

The message in the Pull requests should contain a reference so the issue if there is one. Ex `Closes #<issue number>`, `Fixes #<issue number>`, or `Ref #<issue number>` if the change is related to an issue but does not close it. Make sure to explain what problem the pull request is solving and why its implemented this way. As a new contributor its often better to overcommunicate to avoid back and forth communication, as it consumes time and energy.

### GIT commit formating.

Grafana Squash Pull requests when merging them into master. This means the maintainer will be responsible for the title in the git commit message.
The commit message of the commits in the Pull Request can still be part of the git commit body. So it's always encouraged to write informative commit messages.

The Git commit title should be short, descriptive and include the Pull Request ID.

Good Examples

- `Explore: Live supprt in datasources (#12345)`
- `GraphPanel: Fix legend sorting issues (#12345)`
- `Build: Support publishing MSI to grafana.com (#12345)`

Its also good practice to include a reference to the issue in the git commit body when possible.
