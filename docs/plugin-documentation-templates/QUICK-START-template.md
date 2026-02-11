# Quick start guide

This guide helps you get started with [Plugin Name] quickly.

## Prerequisites

Before you begin, ensure you have:

- [Plugin Name] installed and configured
- A dashboard where you can add panels
- [Any data or credentials required]

## Step 1: Add a data source

To add a [Plugin Name] data source:

1. Click **Connections** in the main menu.
2. Click **Add new connection**.
3. Search for "[Plugin Name]".
4. Click **Create a [Plugin Name] data source**.

## Step 2: Configure connection

Configure the data source connection:

1. Enter a **Name**: `[Example Name]`
2. Enter the **URL**: `[example-url]`
3. Configure authentication:
   - Select your authentication method
   - Enter credentials
4. Click **Save & test**.

You should see a success message confirming the connection works.

## Step 3: Create your first visualization

To create your first visualization:

1. Navigate to a dashboard or create a new one.
2. Click **Add** > **Visualization**.
3. Select your [Plugin Name] data source from the dropdown.

## Step 4: Write a query

In the query editor, enter your first query:

```
[example query]
```

**What this query does**: [Brief explanation]

Click **Run query** to execute the query.

You should see [description of expected result].

## Step 5: Customize the visualization

Customize how your data appears:

1. In the **Visualization** section, select a visualization type (for example, Time series, Bar chart, or Table).

2. Configure visualization options:
   - **Panel options**: Set the title and description
   - **Legend**: Configure legend display
   - **Axis**: Configure axis labels and scales
   - **Graph styles**: Configure line styles, colors, and fill

3. Click **Apply** to save the panel.

## Step 6: Add more queries

To add multiple queries to the same panel:

1. Click **+ Query** below the existing query.
2. Enter another query:

```
[second example query]
```

3. Click **Run query**.

Both queries now appear in the same visualization.

## Step 7: Use variables

Variables make dashboards dynamic and reusable.

To create a variable:

1. Click the dashboard settings icon (gear) in the top right.
2. Navigate to **Variables**.
3. Click **Add variable**.
4. Configure the variable:
   - **Name**: `environment`
   - **Type**: `Query`
   - **Data source**: Select your [Plugin Name] data source
   - **Query**: `[variable query example]`
5. Click **Apply**.

To use the variable in queries:

```
[query using $environment variable]
```

## Step 8: Set up alerting (optional)

To create an alert from your panel:

1. In the panel editor, click the **Alert** tab.
2. Click **Create alert rule from this panel**.
3. Configure alert conditions:
   - Set the threshold value
   - Configure alert evaluation interval
4. Add notification channels.
5. Click **Save**.

Refer to [Grafana alerting documentation](https://grafana.com/docs/grafana/latest/alerting/) for detailed alerting configuration.

## Step 9: Save the dashboard

To save your dashboard:

1. Click the **Save** icon (disk) at the top.
2. Enter a dashboard name: `My First [Plugin Name] Dashboard`
3. Select a folder or create a new one.
4. Click **Save**.

## Common query examples

### Example 1: [Common use case 1]

```
[example query 1]
```

**Description**: [What this query does]

**Use case**: [When to use this query]

### Example 2: [Common use case 2]

```
[example query 2]
```

**Description**: [What this query does]

**Use case**: [When to use this query]

### Example 3: [Common use case 3]

```
[example query 3]
```

**Description**: [What this query does]

**Use case**: [When to use this query]

## Tips and best practices

### Query optimization

- **Limit time ranges**: Shorter time ranges return results faster
- **Use filters**: Add filters to reduce the data volume
- **Aggregate data**: Use aggregation functions to summarize data
- **Limit series**: Return only the series you need

### Dashboard design

- **Use meaningful titles**: Give panels descriptive titles
- **Group related panels**: Organize panels logically
- **Use consistent time ranges**: Align time ranges across panels
- **Add descriptions**: Use panel descriptions to explain what each visualization shows

### Variables and templates

- **Create reusable dashboards**: Use variables for environment, region, or service names
- **Chain variables**: Use one variable to filter options in another
- **Multi-value variables**: Allow selecting multiple values for flexibility

### Performance

- **Use appropriate refresh intervals**: Don't refresh too frequently
- **Optimize queries**: Write efficient queries that return only necessary data
- **Use caching**: Enable caching in data source configuration
- **Limit max data points**: Reduce the number of data points for better performance

## Troubleshooting

### Query returns no data

If your query returns no data:

1. Verify the time range includes data
2. Check query syntax for errors
3. Test the query directly in the data source
4. Review filters that might exclude all data

Refer to [Troubleshooting guide](troubleshooting.md) for more solutions.

### Connection test fails

If the connection test fails:

1. Verify the URL is correct and accessible
2. Check authentication credentials
3. Review firewall rules
4. Check data source logs for errors

Refer to [Troubleshooting guide](troubleshooting.md) for detailed solutions.

## Next steps

Now that you've created your first visualization, explore more features:

- [Query syntax reference](query-syntax.md) - Learn advanced query syntax
- [Configuration guide](configuration.md) - Explore all configuration options
- [Common use cases](common-use-cases.md) - See practical examples
- [Best practices](best-practices.md) - Learn best practices for dashboards and queries
- [Troubleshooting guide](troubleshooting.md) - Resolve common issues

## Get help

If you need help:

- [Documentation](README.md) - Complete documentation
- [Community forum](https://community.grafana.com/) - Ask questions
- [GitHub issues](https://github.com/[your-username]/[your-plugin-repo]/issues) - Report bugs
- [FAQ](faq.md) - Common questions and answers
