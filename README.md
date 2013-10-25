# Kibana

__NOTE__: You have reached the Kibana 3 repository.
Kibana 3 is a completely new version of Kibana written entirely in HTML and Javascript. You can find
the Kibana 2 repository at [https://github.com/rashidkpc/Kibana](https://github.com/rashidkpc/Kibana)

### Important!
The dashboard storage format has changed in Kibana 3 milestone 3. Existing dashboards are unfortunately not backward compatible. However there are some great new features:
* Every panel supports multi-query
* Customizable query colors and labels
* Queries, labels and colors are synced across panels at all times
* Queries can be assigned explicitly to panels, they can also be pinned and unpinned
* New filtering functionality
* Filters can be toggled, removed and edited
* Drill down won't overwrite your queries, labels or colors
* Confusing group functionality has been removed
* Index configuration has been moved from the timepicker, to the main dashboard editor
* The stringquery panel has been replaced with a more polished 'query' panel

More information about Kibana 3 can be found at [http://www.elasticsearch.org/overview/kibana/](http://www.elasticsearch.org/overview/kibana/)

## Overview

Kibana is an open source (Apache Licensed), browser based analytics and search interface to Logstash
and other timestamped data sets stored in ElasticSearch. With those in place Kibana is a snap to
setup and start using (seriously). Kibana strives to be easy to get started with, while also being
flexible and powerful

### Requirements
* A modern web browser. The latest version of Chrome, Safari and Firefox have all been tested to
work. IE9 and greater should work. IE8 does not.
* A webserver. No extensions are required, as long as it can serve plain html it will work
* A browser reachable Elasticsearch server. Port 9200 must be open, or a proxy configured to allow
access to it.

### Installation

1. Download and extract [http://download.elasticsearch.org/kibana/kibana/kibana-latest.zip](http://download.elasticsearch.org/kibana/kibana/kibana-latest.zip) to your webserver.
2. Edit config.js in your deployed directory to point to your elasticsearch server. This should __not be
http://localhost:9200__, but rather the fully qualified domain name of your elasticsearch server.
The url entered here _must be reachable_ by your browser.
3. Point your browser at your installation. If you're using Logstash with the default indexing
configuration the included Kibana logstash interface should work nicely.

### FAQ
__Q__: Why doesnt it work? I have http://localhost:9200 in my config.js, my webserver and elasticsearch
server are on the same machine
__A__: Kibana 3 does not work like previous versions of Kibana. To ease deployment, the server side
component has been eliminated. Thus __the browser connects directly to Elasticsearch__. The default
config.js setup works for the webserver+Elasticsearch on the same machine scenario. Do not set it
to http://localhost:9200 unless your browser and elasticsearch are on the same machine

__Q__: How do I secure this? I don't want to leave 9200 open.
__A__: A simple nginx virtual host and proxy configuration can be found in the sample/nginx.conf

### Support

If you have questions or comments the best place to reach me is #logstash or #elasticsearch on irc.freenode.net
