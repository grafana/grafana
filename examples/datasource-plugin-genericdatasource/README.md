#Generic backend datasource#

More documentation about datasource plugins can be found in the [Docs](https://github.com/grafana/grafana/blob/master/docs/sources/plugins/datasources.md)

Your backend need implement 4 urls
 * "/" Should return 200 ok. Used for "Test connection" on the datasource config page.
 * "/search" Used by the find metric options on the query tab in panels
 * "/query" Should return metrics based on input
 * "/annotations" should return annotations

## Example backend implementation ##
https://gist.github.com/bergquist/bc4aa5baface3cffa109