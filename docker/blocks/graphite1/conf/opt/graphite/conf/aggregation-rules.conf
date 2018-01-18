# The form of each line in this file should be as follows:
#
#   output_template (frequency) = method input_pattern
#
# This will capture any received metrics that match 'input_pattern'
# for calculating an aggregate metric. The calculation will occur
# every 'frequency' seconds and the 'method' can specify 'sum' or
# 'avg'. The name of the aggregate metric will be derived from
# 'output_template' filling in any captured fields from 'input_pattern'.
#
# For example, if you're metric naming scheme is:
#
#   <env>.applications.<app>.<server>.<metric>
#
# You could configure some aggregations like so:
#
#   <env>.applications.<app>.all.requests (60) = sum <env>.applications.<app>.*.requests
#   <env>.applications.<app>.all.latency (60) = avg <env>.applications.<app>.*.latency
#
# As an example, if the following metrics are received:
#
#   prod.applications.apache.www01.requests
#   prod.applications.apache.www01.requests
#
# They would all go into the same aggregation buffer and after 60 seconds the
# aggregate metric 'prod.applications.apache.all.requests' would be calculated
# by summing their values.
#
# Template components such as <env> will match everything up to the next dot.
# To match metric multiple components including the dots, use <<metric>> in the
# input template:
#
#   <env>.applications.<app>.all.<app_metric> (60) = sum <env>.applications.<app>.*.<<app_metric>>
#
# Note that any time this file is modified, it will be re-read automatically.
