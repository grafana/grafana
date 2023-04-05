#!/bin/bash

current_dir=$( dirname $0 )
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <user_id> <alg> [--no-pause]"
    exit 1
fi

source $current_dir/utils.sh
no_pause="$3"

answer=$( cat $current_dir/registerapp_response.json )
client_id=$( echo $answer | jq -r '.clientId' )
client_secret=$( echo $answer | jq -r '.clientSecret' )
privateKey=$( echo $answer | jq '.key.private' )
publicKey=$( echo $answer | jq '.key.public' )

user_id="$1"
alg="$2"
auth_server="http://localhost:3000/oauth2/token"

private_key_file="$current_dir/generated_private_key.pem"
echo -e $privateKey | tr -d '"' > $private_key_file

public_key_file="$current_dir/generated_public_key.pem"
echo -e $publicKey | tr -d '"' > $public_key_file

# Todo add jku and kid
header="{
    \"alg\": \"$alg\",
    \"typ\": \"JWT\",
    \"kid\": \"1\"
}"

payload="{
    \"iss\": \"$client_id\",
    \"sub\": \"$user_id\",
    \"aud\": \"$auth_server\",
    \"exp\": $( date -d '+1 hour' +%s ),
    \"iat\": $( date +%s ),
    \"jti\": \"$( uuidgen )\"
}"

echo "============================"
echo "== Preparing assertion... =="
echo "============================"
echo "header:"
echo $header | jq
echo "payload:"
echo $payload | jq

pause

echo "========================================"
echo "== Signing assertion with private key =="
echo "========================================"
echo $header | jq -c . | tr -d '\n' | tr -d '\r' | base64 | tr +/ -_ | tr -d '=' |tr -d '\n'  > header.b64
echo $payload | jq -c . | tr -d '\n' | tr -d '\r' | base64 | tr +/ -_ |tr -d '=' |tr -d '\n' > payload.b64
printf "%s" "$(<header.b64)" "." "$(<payload.b64)" > unsigned.b64
rm header.b64
rm payload.b64

if [[ "$alg" == "ES256" ]]
then
    echo "Creating ES256 signature"
    sign-jwt-ecdsa -pk $private_key_file -payload unsigned.b64 > sig.b64
else
    echo "Creating RS256 signature"
    openssl dgst -sha256 -sign $private_key_file -out sig.txt unsigned.b64
    cat sig.txt | base64 | tr +/ -_ | tr -d '=' | tr -d '\n' > sig.b64
    rm sig.txt
fi

assertion2=$(printf "%s" "$(<unsigned.b64)" "." "$(<sig.b64)")
rm unsigned.b64
rm sig.b64


echo "assertion:"
echo -e ${blue}$(echo $assertion2 | cut -d '.' -f 1)${reset}.${green}$(echo $assertion2 | cut -d '.' -f 2)${reset}.${red}$(echo $assertion2 | cut -d '.' -f 3)${reset}

# ================================================================

pause

echo "=================================="
echo "== Sending jwtbearer request... =="
echo "=================================="
echo -e "curl -X ${blue}POST${reset} -H ${blue}\"Content-type: application/x-www-form-urlencoded\"${reset} \
-d grant_type=${blue}\"urn:ietf:params:oauth:grant-type:jwt-bearer\"${reset} \
-d assertion=${blue}\"$assertion2\"${reset} \
-d client_id=${blue}\"$client_id\"${reset} \
-d client_secret=${blue}\"$client_secret\"${reset} \
-d scope=${blue}\"openid impersonate profile email teams permissions org.1\"${reset} \
${red}http://localhost:3000/oauth2/token"${reset}
echo

# TODO fix scope
curl -X POST -H 'Content-type: application/x-www-form-urlencoded' \
-d grant_type="urn:ietf:params:oauth:grant-type:jwt-bearer" \
-d assertion="$assertion2" \
-d client_id="$client_id" \
-d client_secret="$client_secret" \
-d scope="openid impersonate profile email teams permissions org.1" \
http://localhost:3000/oauth2/token | jq > $current_dir/jwtbearer_token.json

pause

echo "===================="
echo "== Received token =="
echo "===================="
cat $current_dir/jwtbearer_token.json | jq

pause

echo "================="
echo "==    token    =="
echo "================="

at=$( cat $current_dir/jwtbearer_token.json | jq -r '.access_token' )
header=$( echo $at | cut -d "." -f 1 | base64 -d 2>/dev/null)
payload=$( echo $at | cut -d "." -f 2 | base64 -d 2>/dev/null)
signature=$( echo $at | cut -d "." -f 3 )

echo "header:"
echo $header | jq
echo "payload:"
echo $payload | jq
echo "signature:"
echo $signature