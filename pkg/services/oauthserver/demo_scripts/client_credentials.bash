#!/bin/bash

current_dir=$( dirname $0 )

source $current_dir/utils.sh
no_pause="$1"

answer=$( cat $current_dir/registerapp_response.json )
client_id=$( echo $answer | jq -r '.clientId' )
client_secret=$( echo $answer | jq -r '.clientSecret' )


echo "========================================="
echo "== Sending credential grant request... =="
echo "========================================="
echo -e "curl -X ${blue}POST${reset} -H ${blue}'Content-type: application/x-www-form-urlencoded'${reset} \
-d grant_type=${blue}client_credentials${reset} \
-d client_id=${blue}$client_id${reset} \
-d client_secret=${blue}$client_secret${reset} \
-d scope=${blue}\"openid profile email teams permissions org.1\"${reset} \
${red}http://localhost:3000/oauth2/token${reset}"

curl -X POST -H 'Content-type: application/x-www-form-urlencoded' \
-d grant_type=client_credentials \
-d client_id=$client_id \
-d client_secret=$client_secret \
-d scope="openid profile email teams permissions org.1" \
http://localhost:3000/oauth2/token | jq > $current_dir/client_credentials_token.json

pause

echo "===================="
echo "== Received token =="
echo "===================="
cat $current_dir/client_credentials_token.json | jq

pause

echo "===================="
echo "==    token    =="
echo "===================="

at=$( cat $current_dir/client_credentials_token.json | jq -r '.access_token' )
header=$( echo $at | cut -d "." -f 1|basenc --base64url -d 2>/dev/null)
payload=$( echo $at | cut -d "." -f 2|basenc --base64url -d 2>/dev/null)
signature=$( echo $at | cut -d "." -f 3 )

echo "header:"
echo $header | jq
echo "payload:"
echo $payload | jq
echo "signature:"
echo $signature