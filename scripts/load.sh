#!/usr/bin/env bash
echo "Generating bulk indexable shakespeare lines with timestamp 3 hours in the past and 5 hours into the future"
node reader.js > indexme.json
echo "Setting mapping for shakespeare index"
curl -XPUT http://localhost:9200/_template/shakespeare -d '
{
 "template" : "shakespeare",
 "mappings" : {
  "_default_" : {
   "properties" : {
    "clientip" : { "type" : "ip" },
    "speaker" : {"type": "string", "index" : "not_analyzed" },
    "play_name" : {"type": "string", "index" : "not_analyzed" },
    "line_id" : { "type" : "integer", "index": "not_analyzed" },
    "speech_number" : { "type" : "integer", "index": "not_analyzed" },
    "state" : {"type": "string", "index" : "not_analyzed" },
    "country" : {"type": "string", "index" : "not_analyzed" }
   }
  }
 }
}
'
echo
echo "Performing bulk indexing into localhost:9200"
curl -XPUT localhost:9200/_bulk --data-binary @indexme.json;echo
echo
echo "If tons of JSON just scrolled above, I've probably successfully loaded over 100,000 lines of shakespeare into localhost:9200/shakespeare"
