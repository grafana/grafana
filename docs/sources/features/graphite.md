----
page_title: Graphite query guide
page_description: Graphite query guide
page_keywords: grafana, graphite, metrics, query, documentation
---

# Graphite

Grafana has an advanced graphite query editor that lets you quickly navigate the metric space, add functions.
Change function paramaters and much more. The editor cannot handle all types of queries yet.
To switch to a regular text box click the pen icon to the right.

## Navigate metric segments

Click the ``Select metric`` link to start navigating the metric space. One you start you can continue using the mouse
or keyboard arrow keys. You can select a wildcard and still continue.

![](/img/animated_gifs/graphite_query1.gif)

## Functions

Click the plus icon to the right to add a function. You can search for the function or select it from the menu. Once
a function is selected it will be added and your focus will be in the text box of the first parameter. To later change
a parameter just click on it and it will turn into a text box. To delete a function click the function name followed
by the x icon.

![](/img/animated_gifs/graphite_query2.gif)


### Optional parameters
Some functions like aliasByNode support an optional second argument. To add this parameter specify for example 3,-2 as the first parameter and the function editor will adapt and move the -2 to a second parameter. To remove the second optional parameter just click on it and leave it blank and the editor will remove it.

![](/img/animated_gifs/func_editor_optional_params.gif)
