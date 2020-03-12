DELETE THIS LINE: If draft = false, then the document will not be built in the doc site. If the date is earlier than the build date, than the document will not show in the build site. Use these settings to control whether future content is shown in the doc site.
+++
draft = "false"
date = "yyyy-mm-dd"
title = "Title in sentence case"
description = "Description in title case"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
[menu.docs]
name = "Name of topic"
identifier = "identifier"
parent = "menu parent"
weight = 100
+++

# Reference

The *reference* topic type is for storing reference information, such as extensive tables, lists, or other information that is used as support for a task. Reference topics are also designed for API information.

Often reference topics are linked from *task* topics, because they contain information the user needs in order to perform a task.

[Grafana CLI](https://grafana.com/docs/grafana/latest/administration/cli/) is one example of a reference topic.

## Lists

Lists of commands or parameters are often organized in reference topics. The information you need to present will dictate the format.

* They might
* be in
* unordered lists.

[Configuration](https://grafana.com/docs/grafana/latest/installation/configuration/) is an example of lists.

## Tables

If you have a large list of things to store in a table, then you are probably dealing with reference information. Hugo accepts either tables in Markdown or in HTML format, so use whichever is easier for you.

The [Glossary](https://grafana.com/docs/grafana/latest/guides/glossary/) provides an example of reference data in a table.

### Empty markdown table

While you might not need a heading for each table, headings are a good way to chunk information if you have several tables. They also make the content easy to skim. Use headings or intro paragraphs like this one to explain to the reader what the information in the table is used for.

|    |    |    |    |    |    |
|:---|:---|:--:|:--:|---:|---:|
|    |    |    |    |    |    |
|    |    |    |    |    |    |
|    |    |    |    |    |    |
|    |    |    |    |    |    |

### Empty HTML table

And here is intro text, similar to the paragraph in the previous section. Do not add local styling to the table. The website CSS will take care of that for you.

<table>
  <tr>
    <th>Firstname</th>
    <th>Lastname</th> 
    <th>Age</th>
  </tr>
  <tr>
    <td>Jill</td>
    <td>Smith</td> 
    <td>50</td>
  </tr>
  <tr>
    <td>Eve</td>
    <td>Jackson</td> 
    <td>94</td>
  </tr>
</table>

## API documentation

API documentation is always a reference topic rather than a task topic, but it has its own rules.
