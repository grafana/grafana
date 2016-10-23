<!--- +++ --->
<!--- title = "Alerting" --->
<!--- description = "Alerting" --->
<!--- keywords = ["grafana", "alerting", "guide"] --->
<!--- type = "docs" --->
<!--- [menu.docs] --->
<!--- name = "Alerting" --->
<!--- identifier = "alerting" --->
<!--- parent = "features" --->
<!--- weight = 6 --->
<!--- +++ --->
<!---  --->
<!--- # Alerting --->
<!---  --->
<!--- > Alerting is still in very early development. Please be aware. --->
<!---  --->
<!--- The roadmap for alerting in Grafana have been changing rapidly during last 2-3 months. So make sure you follow the disucssion in the [alerting issue](https://github.com/grafana/grafana/issues/2209). --->
<!---  --->
<!--- ## Introduction --->
<!---  --->
<!--- > Alerting is turned off by default and have to be enabled in the config file. --->
<!---  --->
<!--- Grafana lets you define alert rules based on metrics queries on dashboards. Every alert is connected to a panel and when ever the query for the panel is updated the alerting rule is also updated. --->
<!--- So far only the graph panel supports alerting. To enable alerting for a panel go to the alerting tab and press 'Create alert' button. --->
<!---  --->
<!--- ## Alert status page --->
<!---  --->
<!--- You can overview all your current alerts on the alert stats page at /alerting --->
<!---  --->
<!--- ## Alert notifications --->
<!---  --->
<!--- When an alert is triggered it goes to the notification handler who takes care of sending emails or push data as webhooks. --->
<!--- The alert notifications can be configured on /alerting/notifications --->
<!---  --->
