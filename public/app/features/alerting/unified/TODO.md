# Alerting TODO List

## Rationale

_This is an experiment, if it doesn't work or is disruptive to our workflow we'll revise and adapt._

We often identify smaller items to work on while we refactor code or build a new feature. These items may be small enough not to deserve their own GitHub issue and might make a PR either confusing or too large.

This document aims to make the threshold of adding such items very small to prevent ideas or small improvements from being forgotten or not recorded because we don't feel like creating a formal GitHub issue.

If the item needs more rationale and you feel like a single sentence is inedequate to describe the issue, create a regular GitHub issue.

## Improvements

- Add a `edit` button to the alert detail page

## Refactoring

- Get rid of "+ Add new" in drop-downs : Let's see if is there a way we can make it work with `<Select allowCustomValue />`
- There is a lot of overlap between `RuleActionButtons` and `RuleDetailsActionButtons`. As these components contain a lot of logic it would be nice to extract that logic into hoooks

## Testing

- Re-enable some skipped tests in `NotificationPolicies.test.tsx`

## Bug fixes

_Preferably these should go to GitHub for discoverability, but not all bugs are equal, use your best judgment._
