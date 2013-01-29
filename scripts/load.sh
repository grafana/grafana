#!/usr/bin/env bash
echo "Generating bulk indexable shakespeare lines with timestamp 3 hours in the past and 5 hours into the future"
node reader.js > indexme.json
echo "Performing bulk indexing into localhost:9200"
curl -XPUT localhost:9200/_bulk --data-binary @indexme.json;echo
echo
echo "If tons of JSON just scrolled above, I've probably successfully loaded over 100,000 lines of shakespeare into localhost:9200/shakespeare"
