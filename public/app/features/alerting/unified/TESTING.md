# Alerting testing

## Mocking API requests

We should strive to use **MSW** for mocking API as often as possible.
It gives us the closest behaviour to the real server.

`public/app/features/alerting/unified/mockApi.ts` contains helper functions that speed up mocking API configuration with MSW.

If you don't find a helper for an endpoint you're looking for, please add it.

**Mocking using MSW forces developers to handle loading states in tests which gives us a chance to discover UI inconsistencies at very early stages**

### Common API requests

- `api/v1/eval` used by AlertingQueryRunner
  Use `mockApi.eval` Usually an empty response should do the trick

## Mocking data sources

`public/app/features/alerting/unified/testSetup/datasources.ts` file contains functions facilitating setting up mock data sources.

## Mocking permissions

By default tests should be written with RBAC enabled. This is the most common scenario for our users.
Testing with RBAC disabled should be considered as an additional option when we already have tests for enabled RBAC.

To enable or disable Role Based Access Control in tests use
`enableRBAC` or `disableRBAC` from `public/app/features/alerting/unified/mocks.ts`

To grant a permission to a user use `grantUserPermission` from the same file.

## Common patterns

TODO
