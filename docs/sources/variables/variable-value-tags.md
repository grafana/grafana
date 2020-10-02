+++
title = "Enter Value tags"
type = "docs"
[menu.docs]
identifier = "variables-value-groups"
parent = "variables"
weight = 500
+++

# Enter variable value groups/tags (experimental feature)

Value groups/tags are a feature you can use to organize variable options. If you have many options in the dropdown for a multi-value variable, then you can use this feature to group the values into selectable tags.

{{< docs-imagebox img="/img/docs/v50/variable_dropdown_tags.png" max-width="300px" >}}

This feature is off by default. Click **Enabled** to turn the feature on.

To see an example, check out [Templating value groups](https://play.grafana.org/d/000000024/templating-value-groups?orgId=1).

## Tags query

Enter a data source query that should return a list of tags. The tags query returns a list of tags that each represents a group, and the tag values query returns a list of group members. 

For example, the tags query could be a list of regions (Europe, Asia, Americas), and then if the user selects the Europe tag, then the tag values query would return a list of countries -- Sweden, Germany, France, and so on.

If you have a variable with a lot of values (say all the countries in the world), then this allows you to easily select a group of them. If the user selects the tag Europe, all the countries in Europe would be selected.

In this [example dashboard](https://play.grafana.org/d/ZUPhFVGGk/graphite-with-experimental-tags?orgId=1), the server variable has tags enabled. 

## Tag values query

Enter a data source query that should return a list of values for a specified tag key. Use `$tag` in the query to refer to the currently selected tag.

The `$tag` variable will have the value of the tag that the user chooses. 

For example, if you have a Graphite query for tags, `regions.*`, that returns a list of regions. The values query could be `regions.$tag.*`, which if the user chooses Europe would be interpolated to `regions.Europe.*`.
