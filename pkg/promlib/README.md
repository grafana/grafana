# promlib

Prometheus Library (a.k.a. promlib) is the foundation of the Grafana Prometheus data source backend.

### How to tag/version?

- Checkout the commit you want to tag (`git checkout <COMMIT_SHA>`)
- Run `git tag <VERSION>` (For example v0.0.12)
  - NOTE: We're using Lightweight Tags, so no other options are required
- Run `git push origin <VERSION>`
- Verify that the tag was created successfully [here](https://github.com/grafana/grafana/tags)
- DO NOT RELEASE anything! Tagging is enough.
- After tagging and waiting 5-10 minutes for go module registry to catch up just bump the `promlib` version on grafana/grafana
