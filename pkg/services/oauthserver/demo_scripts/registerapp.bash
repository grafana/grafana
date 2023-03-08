#!/bin/bash
current_dir=$( dirname $0 )

source $current_dir/utils.sh
no_pause="$1"

echo "=================================="
echo "==      Registering app...      =="
echo "=================================="
cat $current_dir/registerapp_command.json | jq

pause

echo
echo "=================================="
echo "==      Sending request...      =="
echo "=================================="
echo -e "curl -X ${blue}POST${reset} -H ${blue}'Content-Type: application/json'${reset} \
-d ${blue}\"@$current_dir/registerapp_command.json\"${reset} ${red}http://localhost:3000/oauth2/register${reset}"

curl -X POST -H 'Content-Type: application/json' \
-d "@$current_dir/registerapp_command.json" http://localhost:3000/oauth2/register/ | \
jq > $current_dir/registerapp_response.json

pause

echo
echo "================================="
echo "==      Registered app...      =="
echo "================================="
echo 
cat $current_dir/registerapp_response.json | jq