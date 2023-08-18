# Contribute to 'What's New in Grafana Cloud'

To have a feature presented in [What's New in Grafana Cloud](https://grafana.com/docs/grafana-cloud/whatsnew/), add an entry to the [`index.md`](./index.md) file in this directory.

Use the following template, replace any `<VARIABLE>` with the appropriate text (explained after the template):

```markdown
## <FEATURE>

<!-- <CONTRIBUTOR> -->
<!-- <ON-PREMISE OFFERING> -->

<CLOUD AVAILABILITY> in Grafana <CLOUD OFFERING>

<DESCRIPTION>
```

## _`CONTRIBUTOR`_

The name of the contributor of the feature.
The information is intentionally commented out so that it isn't displayed in the published page.

## _`ON-PREMISE OFFERING`_

One or both of:

- OSS
- Enterprise

Intended availability of the feature when released outside of Grafana Cloud.
The information is intentionally commented out so that it isn't displayed in the published page.

## _`CLOUD AVAILABILITY`_

One of the following [release life cycle stages](https://grafana.com/docs/release-life-cycle/):

- Generally available
- Available in public preview
- Available in private preview
- Experimental

## _`CLOUD OFFERING`_

One of:

- Cloud Free
- Cloud Pro
- Cloud Advanced
- Cloud

## _`DESCRIPTION`_

Include an overview of the feature and problem it solves, and where to learn more.
Link to any appropriate documentation.
You must use relative path references when linking to documentation within the Grafana repository.
Use the Hugo `relref` shortcode for build time link checking.
For more information about the `relref` shortcode, refer to [Links and references](https://grafana.com/docs/writers-toolkit/writing-guide/references/).
