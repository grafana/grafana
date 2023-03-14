<!--

Thank you for sending a pull request! Here are some tips:

1. If this is your first time, please read our contribution guide at https://github.com/grafana/grafana/blob/main/CONTRIBUTING.md

2. Ensure you include and run the appropriate tests as part of your Pull Request.

3. In a new feature or configuration option, an update to the documentation is necessary. Everything related to the documentation is under the docs folder in the root of the repository.

4. If the Pull Request is a work in progress, make use of GitHub's "Draft PR" feature and mark it as such.

5. If you can not merge your Pull Request due to a merge conflict, Rebase it. This gets it in sync with the main branch.

6. Name your PR as "<FeatureArea>: Describe your change", e.g. Alerting: Prevent race condition. If it's a fix or feature relevant for the changelog describe the user impact in the title. The PR title is used to auto-generate the changelog for issues marked with the "add to changelog" label.

7. If your PR content should be added to the What's New document for the next major or minor release, add the **add to what's new** label to your PR. Note that you should add this label to the main PR that introduces the feature; do not add this label to smaller PRs for the feature.

-->

**What is this feature?**

[Add a brief description of what the feature or update does.]

**Why do we need this feature?**

[Add a description of the problem the feature is trying to solve.]

**Who is this feature for?**

[Add information on what kind of user the feature is for.]

**Which issue(s) does this PR fix?**:

<!--

- Automatically closes linked issue when the Pull Request is merged.

Usage: "Fixes #<issue number>", or "Fixes (paste link of issue)"

-->

Fixes #

**Special notes for your reviewer:**

Please remember to:
- [ ] Test the feature from a user's perspective
- [ ] If this is a preview feature, make sure it is behind a feature toggle
- [ ] Check to make sure the docs are updated and if [relevant](https://grafana.com/docs/writers-toolkit/writing-guide/contribute-release-notes/#how-to-determine-if-content-belongs-in-a-whats-new-document), added to [What's New](https://grafana.com/docs/writers-toolkit/writing-guide/contribute-release-notes/)
- [ ] Check for compatibility issues with older supported versions of Grafana, and plugins
- [ ] Conduct a [Hosted Grafana feature readiness review](https://docs.google.com/document/d/1QL9Ly8KnXzpb6ISbg49pTODRO5mhA5tkkfIZVX6pqQU/edit#heading=h.nmhrirqphdnu) for observability, scalability, performance, and security.

For bigger PRs, or when turning a feature on by default:
- [ ] Make sure the sales and support team has a training on this improvement. That's a 5-10 minute video explaining its benefits and giving a demo of how it works.
<!-- TODO: better description or a link on how to do training -->
- [ ] Organize a [bug bash](https://docs.google.com/document/d/14ZzpE-BWV3MQtULu8XHPR-8AMc_gArV-GXcYg3bx2zg/edit)
- [ ] Get a [#security](https://raintank-corp.slack.com/archives/CHQDPC970) review or threat modeling
- [ ] Check for telemetry, like usage stats or Rudderstack events