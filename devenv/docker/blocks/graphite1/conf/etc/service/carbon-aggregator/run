#!/bin/bash

rm -f /opt/graphite/storage/carbon-aggregator-a.pid
exec /usr/bin/python /opt/graphite/bin/carbon-aggregator.py start --debug 2>&1 >> /var/log/carbon-aggregator.log
