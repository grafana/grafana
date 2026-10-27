# Secure-value resource permissions

The IAM ResourcePermission API supports View, Edit, and Admin assignments for
`secret.grafana.app/securevalues`. The target is the secure value's **name**, not
its Kubernetes UID. Assignments reuse the subject's managed permissions role.

| Level | Access to the named secure value |
| --- | --- |
| View | Read metadata and include the value in authorized list results. |
| Edit | View, update, and delete. |
| Admin | Edit, plus read and change permission assignments. |

These levels grant neither creation nor direct decryption. Existing granular
roles and broad administrator grants remain additive. No existing secret gains
an owner, and no stored secret or role is migrated.

Secure-value list requests use the existing per-secret authorization filter. A
caller with no readable secrets receives an empty list instead of a collection
permission error. The calling service still needs permission to list secrets.
Other operations retain their resource-level authorization checks.

## Availability and administration

The Enterprise registration checks the existing `secretsManager` entitlement.
It registers the mapper in embedded Grafana and the multitenant IAM server. The
mapper remains available to interpret stored assignments when the entitlement
is unavailable; IAM mutation validation still follows the license check.

The IAM resource-permissions API must also be enabled through `[iam] api` or
`kubernetesAuthzResourcePermissionApis`. This change does not enable it by
default or add legacy `/api/access-control/` routes. Licensed self-hosted
Enterprise can use the same API when it is explicitly enabled.

Two fixed roles follow the existing resource-permission conventions:

- `fixed:secret.securevalues.permissions:reader` grants permission reads.
- `fixed:secret.securevalues.permissions:writer` grants permission reads and writes.

Both default to organization Admin, subject to existing grant overrides. The
four existing secret CRUD fixed roles retain their permissions. A provisioning
identity needs create authority and permission-write authority separately;
granting a recipient Edit does not give that recipient either capability.

## Lifecycle contract for callers

Secure values and ResourcePermissions have separate lifecycles. GSM deletion
does not remove the IAM object. A client that creates both must own cleanup of
both, including unsuccessful creation, deletion, and owner removal.

For personal-secret clients:

1. Allocate a fresh opaque name for every new secret. Keep display names and
   environment-variable names separate. Never reuse a retired resource name.
2. Create the secure value, then its grant. Expose the secret as ready only
   after the grant succeeds. On failure, retire the name and clean up both
   records, accounting for an ambiguous permission-write response.
3. Authorize ordinary reads, updates, and deletion as the requesting user.
   After deletion, remove the corresponding ResourcePermission using the
   provisioning identity. Treat an already-absent record as successful cleanup.
4. Retain failed cleanup work for retry. Deleting a user does not itself delete
   their secrets. The owning application must retire those secrets and clean up
   their grants without transferring ownership by matching a login or email.

For other clients that intentionally reuse names, removing the IAM object is
not sufficient evidence of immediate revocation in every authorization backend.
Zanzana hooks are asynchronous and failures are logged after the IAM write.
The Zanzana client also caches authorization decisions for five minutes by
default. This change does not alter cache invalidation or promise immediate
revocation. Such clients must confirm revocation before publishing a replacement under the
same name. Fresh names avoid inheriting a prior object's grants.

## Rollout

Deploy action-set expansion and the Zanzana scope translations to authorization
readers before clients write these new grants. The Enterprise mapper and API
must be available on the serving path. For Zanzana, enable the existing IAM sync
path and use a storage mode that reaches its hooks. An API success alone does
not establish that synchronization finished.

Validate grant creation, level changes, and revocation through IAM against the
configured authorization backend before enabling a client. Clients should
handle unavailable APIs or entitlement failures explicitly, without falling
back to broader user access. Roll back client creation first; retain the
reader support needed to interpret existing grants.
