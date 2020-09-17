+++
title = "Order of Transformations"
type = "docs"
[menu.docs]
identifier = "order_of_transformations"
parent = "panels"
weight = 300
+++

## Order of Transformations

In case there are multiple transformations, Grafana applies them in the exact sequence in which they are listed on the screen. Each transformation creates a new result set that is passed onto the next transformation in the pipeline for processing.

The order in which transformations are applied can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column into a single value, then you can only apply transformations to that single value.
