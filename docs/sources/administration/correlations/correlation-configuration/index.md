---
title: Correlation
weight: 10
---

# Correlation

Each correlation is configured with the following options:

**Label**
: Link label, shown in the visualization

**Description**
: Optional description

**Source data source**
: The source of results that have links displayed

**Results field**
: Defines where the link is shown in a visualization

**Target query**
: The target query run when a link is clicked

**Transformations**
: Optional manipulations to the source data included passed to the target query

Learn how to create correlations using the [Administration page]({{< relref "./create-a-new-correlation#create-a-correlation-in-administration-page" >}}) or with [provisioning]({{< relref "./create-a-new-correlation#create-a-correlation-with-provisioning" >}}).

## Source data source and result field

Links are shown in Explore visualizations for the results from the correlation’s source data source. A link is assigned to one of the fields from the result provided in the correlation configuration (the results field). Each visualization displays fields with links in a different way ([Correlations in Logs Panel]({{< relref "./use-correlations-in-visualizations#correlations-in-logs-panel">}}) and see [Correlations in Table]({{< relref "./use-correlations-in-visualizations#correlations-in-table">}}))

## Target query

The target query is run when a link is clicked in the visualization. You can use the query editor of the selected target data source to specify the target query. Source data results can be accessed inside the target query with variables.

### Correlation Variables

You can use variables inside the target query to access the source data related to the query. Correlations use [Grafana variable syntax]({{< relref "/docs/grafana/latest/dashboards/variables/variable-syntax" >}}). Variables are filled with values from the source results when the link is clicked. There are two types of variables you can use:

- [field variables]({{< relref "/docs/grafana/latest/panels-visualizations/configure-data-links#field-variables" >}}) (allows to access field values and labels)
- correlation variables (allows to access field values and transformations)

Example: If source results contain a field called “employee”, the value of the field can be accessed with:

- A field variable ${\_\_data.fields.employee}
- A correlation variable that maps the field value above to ${employee}

In addition to mapping field values to shorter variable names, more correlation variables can be created by applying transformations to existing fields

For more details, please see the example in [Use variables and transformations in a correlation]({{< relref "./use-variables-and-transformations" >}}).

### Correlation Transformations

Correlations provide a way to extract more variables out of field values. The output of transformations is a set of new variables that can be accessed as any other variable.

There are two types of transformations: logfmt and regular expression.

Each transformation uses a selected field value as the input. The output of a transformation is a set of new variables based on the type and options of the transformation.

For more details, please see the example in [Use variables and transformations in a correlation]({{< relref "./use-variables-and-transformations" >}}) for more details.

### Logfmt transformation

The logfmt transformation deconstructs a field value containing text formatted with [logfmt key/value pairs](https://brandur.org/logfmt). Each pair becomes a variable with the key being the name of the variable.

The logfmt transformation only requires specifying the input field name if you would like the transformation to apply to a different field than the results field.
Example output variables for field = “host=srv001 endpoint=/test app=foo”:

| name     | value  |
| :------- | :----- |
| host     | srv001 |
| endpoint | /test  |
| app      | foo    |

### Regular expression transformation

The regular expression transformation deconstructs a field value based on the provided regular expression.

Regular expression transformation options:

**field**
: Input field name

**expression**
: Regular expression. Named capture groups are mapped to variables matching the group name. If non-named matching groups are used a variable is created out of the first match. The value overrides the variable matching the input field or a new variable is created if mapValue is provided (check the example below)

**mapValue**
: Used with simple regex groups without named matching groups. By default, the first match overrides the variable with the name of the field that is used as the input. To change that default behavior you can specify the mapValue property. The provided name is used to create a new variable. This can be useful if your target query requires both the exact value and a part of the value extracted with the transformation.

Example: Assuming the selected field name is “employee” and the field value is “John Doe”.

Various output variables based on expression and mapValue options:

| expression        | mapValue | output variables             | comment                                                                                           |
| :---------------- | :------- | :--------------------------- | :------------------------------------------------------------------------------------------------ |
| /\\w+ (\\w+)/     | -        | employee=Doe                 | No mapValue provided. The first matching is mapped to the existing field name variable (employee) |
| /(\\w+) (\\w+)/   | name     | name=John                    | The first matching is mapped to a new variable called “name”                                      |
| /(?\\w+) (?\\w+)/ | -        | firstName=John, lastName=Doe | When named groups are used they are the names of the output variables and mapValue is ignored.    |
| /(?\\w+) (?\\w+)/ | name     | firstName=John, lastName=Doe | Same as above                                                                                     |
