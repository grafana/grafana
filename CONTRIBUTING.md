# Contributing

Grafana uses GitHub to manage contributions. Contributions take the form of pull requests that will be reviewed by the core team.

- If you are a new contributor, see [Steps to contribute](#steps-to-contribute).

- If you have a trivial fix or improvement, go ahead and create a pull request.

- If you plan to do something more involved, then discuss your idea on the respective [issue](https://github.com/grafana/grafana/issues) or create a [new issue](https://github.com/grafana/grafana/issues/new) if one does not exist. This helps avoid unnecessary work and gives you and us a good deal of inspiration.

- Sign our [CLA](http://docs.grafana.org/contribute/cla/).

- Follow the code style guides:
  - [Backend style guide](https://github.com/grafana/grafana/tree/master/pkg)
  - [Frontend style guide](https://github.com/grafana/grafana/tree/master/style_guides)

## Steps to contribute

Should you wish to work on a GitHub issue, check first if it is not already assigned to someone. If it is free, you claim it by commenting on the issue that you want to work on it. This is to prevent duplicated efforts from contributors on the same issue.

Please check the [`beginner friendly`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) and [`help wanted`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) labels to find issues that are good for getting started. If you have questions about one of the issues, with or without the tag, please comment on them and one of the core team or the original poster will clarify it.

To set up a local development environment we recommend reading [Building Grafana from source](http://docs.grafana.org/project/building_from_source/).

## Pull request checklist

Whether you are contributing or doing code review, first read and understand https://google.github.io/eng-practices/review/reviewer/ for general engineering practices around code reviews that we also use.

- Branch from the master branch and, if needed, rebase to the current master branch before submitting your pull request. If it doesn't merge cleanly with master, then you might be asked to rebase your changes.

- If your patch is not getting reviewed or you need a specific person to review it, then you can @-reply a reviewer asking for a review in the pull request or a comment.

- Add tests relevant to the fixed bug or new feature.

### High-level checks

- [ ] The pull request adds value and the impact of the change is in line with the [Backend style guide](https://github.com/grafana/grafana/tree/master/pkg) or [Frontend style guide](https://github.com/grafana/grafana/tree/master/style_guides).
- [ ] The pull request works the way it says it should do.
- [ ] The pull request closes one issue if possible and does not fix unrelated issues within the same pull request.
- [ ] The pull request contains necessary tests.

### Low-level checks

- [ ] The pull request contains a title that explains it. It follows [PR and commit messages guidelines](#Pull-Requests-titles-and-message).
- [ ] The pull request contains necessary links to issues. 
- [ ] The pull request contains commits with messages that are small and understandable. It follows [PR and commit messages guidelines](#Pull-Requests-titles-and-message).
- [ ] The pull request does not contain magic strings or numbers that could be replaced with an `Enum` or `const` instead.

#### Bug-specific checks

- [ ] The pull request contains `Closes: #Issue` or `Fixes: #Issue` in pull request description.
- [ ] The Pull Request adds tests that replicate the fixed bug and helps avoid regressions.

### Frontend-specific checks

- [ ] The pull request does not increase the Angular code base.
  > We are in the process of migrating to React so any increment of Angular code is generally discouraged.
- [ ] The pull request does not contain uses of `any` or `{}` without comments describing why.
- [ ] The pull request does not contain large React components that could easily be split into several smaller components.
- [ ] The pull request does not contain back end calls directly from components, use actions and Redux instead.

#### Redux specific checks (skip if your pull request does not contain Redux changes)

- [ ] The pull request does not contain code that mutates state in reducers or thunks.
- [ ] The pull request uses helpers `actionCreatorFactory` and `reducerFactory` instead of traditional `switch statement` reducers in Redux. See [Redux framework](https://github.com/grafana/grafana/tree/master/style_guides/redux.md) for more details.
- [ ] The pull request uses `reducerTester` to test reducers. See [Redux framework](https://github.com/grafana/grafana/tree/master/style_guides/redux.md) for more details.
- [ ] The pull request does not contain code that accesses the reducers state slice directly, instead, the code uses state selectors to access state.

### Pull request titles and message

Pull request titles should follow this format: `Area: Name of the change`. Titles are used to generate the changelog so they should be as descriptive as possible in one line.

Good examples:

- `Explore: Adds Live option for supported data sources`
- `GraphPanel: Don't sort series when legend table & sort column is not visible`
- `Build: Support publishing MSI to grafana.com`

The message in the pull requests should contain a reference so the issue if there is one. For example, `Closes #<issue number>`, `Fixes #<issue number>`, or `Ref #<issue number>` if the change is related to an issue but does not close it. Make sure to explain what problem the pull request is solving and why its implemented this way. As a new contributor its often better to overcommunicate to avoid back-and-forth communication, as it consumes time and energy.

### Git commit formatting

Grafana Squash Pull requests when merging them into master. This means the maintainer will be responsible for the title in the git commit message.
The commit message of the commits in the Pull Request can still be part of the git commit body. So it's always encouraged to write informative commit messages.

The Git commit title should be short, descriptive and include the Pull Request ID.

Good examples:

- `Explore: Live supprt in data sources (#12345)`
- `GraphPanel: Fix legend sorting issues (#12345)`
- `Build: Support publishing MSI to grafana.com (#12345)`

Its also good practice to include a reference to the issue in the Git commit body when possible.
