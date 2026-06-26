# Scorecard Known Limitations

## Private or deleted plugin repositories

Plugins whose GitHub repository URL is listed in the Grafana plugin catalog but is private or has been deleted will show N/A in the scorecard badge. The sidecar cannot clone the repo and OpenSSF has no record of it, so no score can be produced.

Example: `aws-datasource-provisioner-app` lists `https://github.com/grafana/aws-datasource-provisioner-app` in GCOM but the repo returns 404 from GitHub even using a GitHub token with public repo scope. The plugin catalog sidebar still shows the link, which is misleading to users who expect to be able to audit the source code.
