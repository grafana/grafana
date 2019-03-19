# Relay destination rules for carbon-relay. Entries are scanned in order,
# and the first pattern a metric matches will cause processing to cease after sending
# unless `continue` is set to true
#
#  [name]
#  pattern = <regex>
#  destinations = <list of destination addresses>
#  continue = <boolean>  # default: False
#
#  name: Arbitrary unique name to identify the rule
#  pattern: Regex pattern to match against the metric name
#  destinations: Comma-separated list of destinations.
#    ex: 127.0.0.1, 10.1.2.3:2004, 10.1.2.4:2004:a, myserver.mydomain.com
#  continue: Continue processing rules if this rule matches (default: False)

# You must have exactly one section with 'default = true'
# Note that all destinations listed must also exist in carbon.conf
# in the DESTINATIONS setting in the [relay] section
[default]
default = true
destinations = 127.0.0.1:2004:a, 127.0.0.1:2104:b
