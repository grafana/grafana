# Create a pull request

Every contribution to Grafana's software begins with a [pull request](https://help.github.com/en/articles/about-pull-requests/). This document guides you through the process of creating a PR.

## Before you begin

We know you're excited to create your first pull request. Before we get started, read these resources first:

- Get started [contributing to Grafana](/CONTRIBUTING.md).
- Make sure your code follows the relevant [style guides](/contribute/style-guides).
- It's recommended you [set up precommit hooks](/contribute/developer-guide.md) to auto-format when you commit

## Your first pull request

If this is your first time contributing to an open-source project on GitHub, make sure you read GitHub's article on [creating a pull request](https://help.github.com/en/articles/creating-a-pull-request).

To increase the chance of having your pull request accepted, make sure your pull request follows these guidelines:

- Title and description matches the implementation.
- Commits within the pull request follow the [formatting guidelines](#Formatting-guidelines).
- The pull request closes one related issue.
- The pull request contains necessary tests that verify the intended behavior.
- If your pull request has conflicts, rebase your branch onto the main branch.

If the pull request fixes a bug:

- The pull request description must include `Closes #<issue number>` or `Fixes #<issue number>`.
- To avoid regressions, the pull request should include tests that replicate the fixed bug.

## Guidelines for frontend development

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
- Not contain code that accesses the reducer's state slice directly. Instead, the code should use state selectors to access state.

Pull requests that add or modify unit tests that are written in Jest must adhere to these guidelines:

- Don't add snapshots tests. We are incrementally removing existing snapshot tests, and so we don't want more.
- If an existing unit test is written in Enzyme, migrate it to React Testing Library (RTL), unless you’re fixing a bug. Bug fixes usually shouldn't include any bigger refactoring, so it’s okay to skip migrating the test to RTL.

Pull requests that create new UI components or modify existing ones must adhere to the following accessibility guidelines:

- Use semantic HTML.
- Use ARIA roles, labels and other accessibility attributes correctly. Accessibility attributes should only be used when semantic HTML doesn't satisfy your use case.
- Use the [Grafana theme palette](/contribute/style-guides/themes.md) for styling. The palette contains colors with good contrast to aid accessibility.
- Use [RTL](https://testing-library.com/docs/dom-testing-library/api-accessibility/) for writing unit tests. It helps to create accessible components.

### Guidelines for accessibility

Before submitting pull requests that introduce accessibility (a11y) errors, refer to the [accessibility guidelines](/contribute/style-guides/accessibility.md).

### ESLint & suppressions

We use [ESLint](https://eslint.org/) to enforce code style and best practices, along with [bulk suppressions](https://eslint.org/docs/latest/use/suppressions#suppressions-file) in order to incrementally improve our code quality and fix rule violations.

- **ESLint runs as a precommit hook**:
  - You may see changes to the `eslint-suppressions.json` file automatically added to your commits.
  - You may get an error when trying to commit something that decreases the overall code quality. You can either fix these errors or temporarily override the checks (for example, to commit something that's a work in progress). To do so, use `git commit --no-verify`. All errors will eventually have to be fixed before your code can be merged because...
- **ESLint also runs as part of our CI**:
  - If you have fixed suppressed issues but not updated the suppressions file, you may see the following error message in the CI: `There are suppressions left that do not occur anymore.`.
    To resolve the error, run the following command: `yarn lint:prune` and commit the changes.
  - You may see merge conflicts for the `eslint-suppressions.json` file. To resolve, merge with the target branch (usually `main`) and resolve conflicts however you like, and then run `yarn lint:prune` to ensure the file is up to date and commit.

## Guidelines for backend development

Refer to the [backend style guidelines](/contribute/backend/style-guide.md).

## Code review

Once you've created a pull request, the next step is to have someone review your change. A review is a learning opportunity for both the reviewer and the author of the pull request.

If you think a specific person needs to review your pull request, then you can tag them in the description or in a comment. To tag a user on GitHub, go to Reviewers box on the Conversations page and enter the `@` symbol followed by their GitHub username.

We recommend that you read [How to do a code review](https://google.github.io/eng-practices/review/reviewer/) to learn more about code reviews.

## Formatting guidelines

A well-written pull request minimizes the time to get your change accepted. The following guidelines help you to write good commit messages and descriptions for your pull requests.

### Commit message format

Grafana uses the guidelines for commit messages outlined in the article [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/), with the following additions:

- Subject line must begin with the _area_ of the commit.
- Footer in the form of an optional [keyword and issue reference](https://help.github.com/en/articles/closing-issues-using-keywords).

#### Area

The _area_ refers to a specific part of Grafana's codebase. It should be given in the upper camel case format. For example: UpperCamelCase.

Prefer using one of the following areas:

- **Build:** Change the build system, or external dependencies
- **Chore:** Change that doesn't affect functionality
- **Dashboard:** Change the Dashboard feature
- **Docs:** Change documentation
- **Explore:** Change the Explore feature
- **Plugins:** Change a plugin

For changes to data sources, the area is the name of the data source. For example, AzureMonitor, Graphite, or Prometheus.

For changes to panels, the area is the name of the panel, suffixed with Panel. For example, GraphPanel, SinglestatPanel, or TablePanel.

**Examples of good commit messages**

- `Build: Support publishing MSI to grafana.com`
- `Explore: Add Live option for supported data sources`
- `GraphPanel: Fix legend sorting issues`
- `Docs: Change url to URL in all documentation files`

If you're unsure, see the existing [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) for inspiration or guidance.

### Pull request titles

The pull request title should be formatted according to `<Area>: <Summary>` (Both "Area" and "Summary" should start with a capital letter).

The Grafana team _squashes_ all commits into one when we accept a pull request. The title of the pull request becomes the subject line of the squashed commit message. We still encourage contributors to write informative commit messages, as they become a part of the Git commit body.

We use the pull request title when we generate change logs for releases. As such, we strive to make the title as informative as possible.

**Example:**

`Docs: Change url to URL in all documentation files`

## Configuration changes

If your pull request includes configuration changes, all the following files must be changed correspondingly:

- `conf/defaults.ini`
- `conf/sample.ini`
- `docs/sources/administration/configuration.md`
