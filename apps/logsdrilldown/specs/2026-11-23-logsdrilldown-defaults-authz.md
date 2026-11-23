# Logs Drilldown defaults: who may write them

Status: open question. The routed path ships a stand-in rule (`plugins:install`) until this is
answered.
Packages: `pkg/services/pluginsintegration/pluginroute`, `pkg/services/authz/rbac`

## Context

The router serves `logsdrilldown.grafana.app` from the app's own installer, so it can be served
multi-tenant. The three defaults kinds now use the same model as announcement banners:

- **Reads:** anyone allowed into the namespace may `get` and `list` them. Storage serves those reads
  as the service identity (`hardcodedNamespaceReadable`).
- **Everything else:** needs the action the RBAC mapper maps the kind to. The router checks that
  mapping through the access client, and storage checks it again where it enforces RBAC.

| Kind                          | Embedded API server rule                        | Routed (RBAC mapper)                    |
| ----------------------------- | ----------------------------------------------- | --------------------------------------- |
| `logsdrilldowndefaultcolumns` | get: all; list/write: `plugins:write`           | get/list: all; write: `plugins:write`   |
| `logsdrilldowndefaultlabels`  | get/list: all; write: `plugins:write`           | same                                    |
| `logsdrilldowndefaults`       | get/list: all; write: Grafana server admin only | get/list: all; write: `plugins:install` |

Listing the default columns becomes open to everyone. Any of those objects could already be fetched
by name, so a list exposes only their names.

## The open question

`logsdrilldowndefaults` writes are Grafana-server-admin only in the embedded API server. RBAC has no
"server admin" action, so the mapper needs a stand-in, and `plugins:install` is the closest one: it
is granted to the Grafana Admin role when `plugin_admin_enabled` is set.

In Grafana Cloud, customers are never Grafana server admins, and service accounts and access
policies fail the embedded check too. So today no customer, not even an org admin, can write
`logsdrilldowndefaults` in Cloud. Only Grafana staff signed in as server admins, and the internal
`system:masters` identity, can.

Before treating `plugins:install` as the final rule, find out:

1. **Who writes `logsdrilldowndefaults` today, and how?** Check the Logs Drilldown plugin
   (`grafana-lokiexplore-app`), provisioning, and any staff or ops tooling.
2. **Should customers be able to set the instance defaults?** If yes, `plugins:write` (org admins,
   like the default columns and labels) is likely the right rule.
3. **Is the kind used at all in Cloud?** If nobody can write it, the design can change much more
   than the action it maps to. The kind could be merged with the default columns and labels, made
   read-only and seeded by Grafana, or removed.

## Related gaps

- **Unified storage checks RBAC for core groups only when `[unified_storage]
authz_exemption_enabled` is on.** Otherwise the router's check is the only one for these kinds,
  as it now is for banners. The router check closes the gap where banner writes on the routed path
  were left to storage alone.
- **Each user's settings (`logsdrilldowns`) are authorized by the owner in the name
  (`hardcodedOwnerFromName`).** With `authz_exemption_enabled` on and no exemption, storage would
  check those user requests against the k8s-native actions, which no role holds. Like user storage,
  the kind needs an exemption or a mapping before that setting is turned on.
- **The embedded API server never checks the name on create.** A user may create another user's
  settings there. The router refuses it.
