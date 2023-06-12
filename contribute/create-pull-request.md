# Create a pull request

We're excited that you're considering making a contribution to the Grafana project! This document guides you through the process of creating a [pull request](https://help.github.com/en/articles/about-pull-requests/).

## Before you begin

We know you're excited to create your first pull request. Before we get started, read these resources first:

- Learn how to start [Contributing to Grafana](/CONTRIBUTING.md).
- Make sure your code follows the relevant [style guides](/contribute/style-guides).

## Your first pull request

If this is your first time contributing to an open-source project on GitHub, make sure you read about [Creating a pull request](https://help.github.com/en/articles/creating-a-pull-request).

To increase the chance of having your pull request accepted, make sure your pull request follows these guidelines:

- Title and description matches the implementation.
- Commits within the pull request follow the [Formatting guidelines](#Formatting-guidelines).
- The pull request closes one related issue.
- The pull request contains necessary tests that verify the intended behavior.
- If your pull request has conflicts, rebase your branch onto the main branch.

If the pull request fixes a bug:

- The pull request description must include `Closes #<issue number>` or `Fixes #<issue number>`.
- To avoid regressions, the pull request should include tests that replicate the fixed bug.

## Frontend-specific guidelines

Pull requests for frontend contributions must:

- Use [Emotion](/contribute/style-guides/styling.md) for styling.
- Not increase the Angular code base.
- Not use `any` or `{}` without reason.
- Not contain large React components that could easily be split into several smaller components.
- Not contain backend calls directly from components—use actions and Redux instead.

Pull requests for Redux contributions must:

- Use the `actionCreatorFactory` and `reducerFactory` helpers instead of traditional switch statement reducers in Redux. Refer to [Redux framework](/contribute/style-guides/redux.md) for more details.
- Use `reducerTester` to test reducers. Refer to [Redux framework](/contribute/style-guides/redux.md) for more details.
- Not contain code that mutates state in reducers or thunks.
- Not contain code that accesses the reducers state slice directly. Instead, the code should use state selectors to access state.

Pull requests that add or modify unit tests that are written in Jest must adhere to these guidelines:

- Don't add snapshots tests. We are incrementally removing existing snapshot tests, we don't want more.
- If an existing unit test is written in Enzyme, migrate it to RTL (React Testing Library), unless you’re fixing a bug. Bug fixes usually shouldn't include any bigger refactoring, so it’s ok to skip migrating the test to RTL.

Pull requests that create new UI components or modify existing ones must adhere to the following accessibility guidelines:

- Use semantic HTML.
- Use ARIA roles, labels and other accessibility attributes correctly. Accessibility attributes should only be used when semantic HTML doesn't satisfy your use case.
- Use the [Grafana theme palette](/contribute/style-guides/themes.md) for styling. It contains colors with good contrast which aids accessibility.
- Use [RTL](https://testing-library.com/docs/dom-testing-library/api-accessibility/) for writing unit tests. It helps to create accessible components.

### Accessibility-specific guidelines

Pull requests that introduce accessibility(a11y) errors - please refer to the [accessibility guidelines](/contribute/style-guides/accessibility.md).

### Betterer

We make use of a tool called [**Betterer**](https://phenomnomnominal.github.io/betterer/) in order to drive long-running code quality improvements. The intention is for this to be as unintrusive as possible, however there are some things to be aware of:

- **Betterer runs as a precommit hook**:
  - You may see changes to the `.betterer.results` file automatically added to your commits.
  - You may get an error when trying to commit something that decreases the overall code quality. You can either fix these errors or temporarily override the checks (e.g. to commit something that's a work in progress) by using `git commit --no-verify`. All errors will eventually have to be fixed before your code can be merged because...
- **Betterer also runs as part of our CI**:
  - You may see the following error message in the CI: `Unexpected changes detected in these tests while running in CI mode`. To resolve, merge with the target branch (usually `main`).
  - You may see merge conflicts for the `.betterer.results` file. To resolve, merge with the target branch (usually `main`) then run `yarn betterer:merge` and commit.

## Backend-specific guidelines

Please refer to the [backend style guidelines](/contribute/backend/style-guide.md).

## Code review

Once you've created a pull request, the next step is to have someone review your change. A review is a learning opportunity for both the reviewer and the author of the pull request.

If you think a specific person needs to review your pull request, then you can tag them in the description or in a comment. Tag a user by typing the `@` symbol followed by their GitHub username.

We recommend that you read [How to do a code review](https://google.github.io/eng-practices/review/reviewer/) to learn more about code reviews.

## Formatting guidelines

A well-written pull request minimizes the time to get your change accepted. These guidelines help you write good commit messages and descriptions for your pull requests.

### Commit message format

Grafana uses the guidelines for commit messages outlined in [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/), with the following additions:

- Subject line must begin with the _area_ of the commit.
- A footer in the form of an optional [keyword and issue reference](https://help.github.com/en/articles/closing-issues-using-keywords).

#### Area

The area should use upper camel case, e.g. UpperCamelCase.

Prefer using one of the following areas:

- **Build:** Change the build system, or external dependencies
- **Chore:** Change that don't affect functionality
- **Dashboard:** Change the Dashboard feature
- **Docs:** Change documentation
- **Explore:** Change the Explore feature
- **Plugins:** Change the ... plugin

For changes to data sources, the area is the name of the data source. For example, AzureMonitor, Graphite, or Prometheus.

For changes to panels, the area is the name of the panel, suffixed with Panel. For example, GraphPanel, SinglestatPanel, or TablePanel.

**Examples**

- `Build: Support publishing MSI to grafana.com`
- `Explore: Add Live option for supported data sources`
- `GraphPanel: Fix legend sorting issues`
- `Docs: Change url to URL in all documentation files`

If you're unsure, see the existing [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) for inspiration or guidance.

### Pull request titles

The pull request title should be formatted according to `<Area>: <Summary>` (Both "Area" and "Summary" should start with a capital letter).

The Grafana team _squashes_ all commits into one when we accept a pull request. The title of the pull request becomes the subject line of the squashed commit message. We still encourage contributors to write informative commit messages, as they becomes a part of the Git commit body.

We use the pull request title when we generate change logs for releases. As such, we strive to make the title as informative as possible.

**Example:**
`Docs: Change url to URL in all documentation files`

## Configuration changes

If your PR includes configuration changes, all of the following files must be changed correspondingly:

- conf/defaults.ini
- conf/sample.ini
- docs/sources/administration/configuration.md
