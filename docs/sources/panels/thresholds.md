title = "Thresholds"
type = "docs"
[menu.docs]
identifier = "thresholds"
parent = "panels"
weight = 300
+++

# Thresholds

Thresholds set the color of either the value text or the background depending on conditions that you define.

You can define thresholds one of two ways:
* **Absolute** thresholds are defined based on a number. For example, 80 on a scale of 1 to 150.
* **Percentage** thresholds are defined relative to minimum and maximums. For example, 80 percent.

You can apply thresholds to the following visualizations:
* Stat
* Gauge
* Bar gauge
* Table
* Graph

## Default thresholds

On visualizations that support it, Grafana sets default threshold values of:
* 80 = red
* Base = green
* Mode = Absolute

The **Base** value represents minus infinity. It is generally the “good” color.

## Add a threshold

You can add as many thresholds to a panel as you want. Grafana automatically sorts thresholds from highest value to lowest.

1. Navigate to the panel you want to add a threshold to.
1. Click the **Field** tab.
1. Click **Add threshold**. 
1. Grafana adds a threshold with suggested numerical and color values.
1. Accept the recommendations or edit the new threshold.
   * **Edit color:** Click the color dot you wish to change and then select a new color.
   * **Edit number:** Click the number you wish to change and then enter a new number.
   * **Thresholds mode -** Click the mode to change it for all thresholds on this panel.
1. Click **Save** to save the changes in the dashboard.

## Delete a threshold

1. Navigate to the panel you want to add a threshold to.
1. Click the **Field** tab.
1. Click the trash can icon next to the threshold you want to remove.
1. Click **Save** to save the changes in the dashboard.
