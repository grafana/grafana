kibana-dashboard
================

Kibana Dashboard Preview

This is very much a preview, many things will change. While it is functional and
useful, please view it as a proof-of-concept. A play ground for ideas :-)

Configuration is in config.js, the default dashboard is in default.json. The
format of both of these is likely to change. Documentation for panel types 
coming soon.

The loading dashboards from disk requires an html5 compliant browser. This has 
been tested on the latest versions of firefox and chrome. 

This is all html and javascript, use it with any webserver, or there is a simple
nodejs webserver in the scripts/ directory, it will listen on port 8000. You'll
likely need to run Kibana Dashboard on an elasticsearch node, and not access it
via a proxy.

Cheers  
Rashid
