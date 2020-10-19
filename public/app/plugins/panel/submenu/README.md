# SubMenu Panel

**What this plugin do / Why we need it**:
See https://github.com/grafana/grafana/issues/28342

**How to use this plugin**:
1. Create a dashboard
1. Add a few variables, links, annotations
1. Set `Hide SubMenu` to true in settings
1. Save dashboard and refresh it (temporary workaround)
1. Add a SubMenu panel
1. Play around with the settings

**Pending Work**
- Dashboard needs to be saved and refreshed before updates to annotations and links are visible in the plugin. Need to fix this
- Change the name SubMenu to something more user-firendly
- Change icon for SubMenu panel
- Maybe add the panel by default to view variables replacing the static SubMenu altogether
- Update tests
