# Grafana Status Panel

This is a plugin meant to be used as a centralized view for the status of component in a glance.
It is very similar to the Single Stat panel, but it can hold multiple values from the same data source.
Each value can be used to customize the panel in different ways: 
* Mark the severity of the component
* Mark if the component is disabled
* Show extra data in the panel about the component  

## The General Idea
Lets say that you want to monitor a bunch of servers, and you want to keep track of multiple stats for each of them, and see in a glance the status of all of them.

This plugin will make it easier to do. You just add all the metrics you want to track, and choose how you want their values to be treated:
1. Component severity marker - Set the threshold for each and you get an overview that will report to you if there is anything wrong with any metrics. That means that if all the metrics are in the OK zone, the panel will be green. If evan one of the metrics is in the WARNING zone, it will be yellow, and red if any of them is CRITICAL.
2. Component disable marker - Set the exact value that represent if the component is disabled, the panel will be grey.
3. Display as text - show extra information about the component in the panel

Severity and text values can be shown in 2 modes:
1. Regular - under the panel title
2. Annotation - In the top left side of the panel

**Note:** The disable markers are prioritized over the severity ones. 

You can also repeat the panel on a template if you have multiple instances that you want to watch.

## How to install (for debugging purposes only)
1. Copy the contents of "Grafana_Status_panel" to the "/var/lib/grafana/plugins" folder
2. Restart grafana by using "service grafana-server restart"
3. Now this panel should be installed.

## How to use
1. Add the queries you want to the panel and give each of them a unique alias
2. Choose the name of the panel to be displayed in the `Panel Title` field.
  **Note:** this field supports Grafana templates, so if you repeat the panel the correct name will show
3. Go the the Options tab, and choose the how to treat each metric. 
	1. For severity display, select the `Threshold` option type under `Handler Type`. Enter the `Warning` and `Critical` thresholds for each of your queries.
		* If you want the result to always be displayed with it's value (regardless to the thresholds), check the box titled `Show Always`
		* In case one of the fields (`Warning`/`Critical`) is a text, there will be equality check with the values.
 		* In case both fields are numbers there will be range check with the values. The plugin automatically detects if higher values are good, or lower values are good by checking which threshold is higher/lower. i.e. if in your metric higher values are better, put a lower value in the `critical` threshold than the `warning` threshold.
	2. For disable display, select the `Disable Criteria` option type under `Handler Type`. Enter the `Disable Value` for each of your queries.
	3. For display the text without any condition, select the `Text Only` option type under `Handler Type`. The alias + the value of the metric will be shown on the panel by the `Display Type` value.
4. If the query returns multiple values, choose the type of aggregation you want to be used (`None` will just use the most first result)

## Other Features

### Remove Prefix
The plugins has a 'Remove Prefix' field in the configuration. This field is is meant for easier renaming of the panels when you repeat them from a Grafana template.

i.e. you recognize your servers by domain, and they are all name in the following way `www.general-prefix.server.com`, and you would like to remove the prefix from the display, then you enter `www.general-prefix.` and all the panels will only display the `server.com` part.

### Display Value by Regex
When you want to display just part of the value for a specific metric in the screen, you can pass a regex in the `Value Regex` field, and if there is match, Only the first match will be displayed. Otherwise, the original value will be displayed.

### Measurement URL
Lets say that you want your user to be able to get instructions on what to do when a certain metric is at Warning or Critical levels. Just put a link in this field and the name will become clickable, and send your user to any URL you desire (like an internal wiki).

### Show disable for no data
If there is not data from any of the metrics, you can show the panel as disabled (in Grey), by checking the value `Make panel gray when no data` on the top of the options tab
## Supported Data Sources
Currently the plugin was tested with **influxDB** and **Graphite**. Support for other data sources could be added by demand

## Release Notes
### Version 1.0.3
* Version (1.0.3) can have some conflicts with older versions.

# Screenshots
### Panel States
![ok](https://github.com/Vonage/Grafana_Status_panel/blob/develop/src/img/ok.png?raw=true)
![warning](https://github.com/Vonage/Grafana_Status_panel/blob/develop/src/img/warning.png?raw=true)
![error](https://github.com/Vonage/Grafana_Status_panel/blob/develop/src/img/error.png?raw=true)

### The end result should look like this
![Result](https://github.com/Vonage/Grafana_Status_panel/blob/develop/src/img/environment_snapshot.png?raw=true)

# License

See the [LICENSE](https://github.com/Vonage/Grafana_Status_panel/blob/master/LICENSE.txt) file for license rights and limitations (Apache License, Version 2.0)
