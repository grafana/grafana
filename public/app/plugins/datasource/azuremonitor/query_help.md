Format the legend keys any way you want by using alias patterns.

- Example for Azure Monitor: `dimension: {{dimensionvalue}}`
- Example for Application Insights: `server: {{groupbyvalue}}`

#### Alias Patterns for Application Insights

- {{groupbyvalue}} = replaced with the value of the group by
- {{groupbyname}} = replaced with the name/label of the group by
- {{metric}} = replaced with metric name (e.g. requests/count)

#### Alias Patterns for Azure Monitor

- {{resourcegroup}} = replaced with the value of the Resource Group
- {{namespace}} = replaced with the value of the Namespace (e.g. Microsoft.Compute/virtualMachines)
- {{resourcename}} = replaced with the value of the Resource Name
- {{metric}} = replaced with metric name (e.g. Percentage CPU)
- {{dimensionname}} = replaced with dimension key/label (e.g. blobtype)
- {{dimensionvalue}} = replaced with dimension value (e.g. BlockBlob)

#### Filter Expressions for Application Insights

The filter field takes an OData filter expression.

Examples:

- `client/city eq 'Boydton'`
- `client/city ne 'Boydton'`
- `client/city ne 'Boydton' and client/city ne 'Dublin'`
- `client/city eq 'Boydton' or client/city eq 'Dublin'`

#### Writing Queries for Template Variables

See the [docs](https://github.com/grafana/azure-monitor-datasource#templating-with-variables) for details and examples.
