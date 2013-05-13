# Kibana
========

__NOTE__: You have reached the Kibana 3 repository. Kibana 3 is completely new version of Kibana written entirely in HTML and Javascript. You can find the Kibana 2 repository at [https://github.com/rashidkpc/Kibana](https://github.com/rashidkpc/Kibana)


## Overview

Kibana is an open source (Apache Licensed), browser based analytics and search interface to Logstash and other timestamped data sets stored in ElasticSearch. With those in place Kibana is a snap to setup and start using (seriously). Kibana strives to be easy to get started with, while also being flexible and powerful

### Requirements
* A modern web browser. The latest version of Chrome, Safari and Firefox have all been tested to work. IE8 is not currently supported
* A webserver. No extensions are required, as long as it can serve plain html it will work
* A browser reachable Elasticsearch server. Port 9200 must be open, or a proxy configured to allow access to it.

### Installation

1. Copy the entire Kibana directory to your webserver
2. Edit config.js to point to your elasticsearch server. This should __not be http://localhost:9200__, but rather the fully qualified domain name of your elasticsearch server. The url entered here _must be reachable_ by your browser.
3. Point your browser at your installation. If you're using Logstash with the default indexing configuration the default Kibana dashboard should work nicely. 

### Support
Introduction videos can be found at [http://three.kibana.org](http://three.kibana.org/about.html)  
If you have questions or comments the best place to reach me is #logstash or #elasticsearch on irc.freenode.net
