#!/bin/bash
current_dir=$( dirname $0 )

if [[ "$#" -lt 1 ]]; then 
    echo "Usage: $0 jwtbearer|client_credentials [--no-pause]"
    exit 1
fi

source $current_dir/utils.sh
no_pause="$2"

if [[ $1 == "jwtbearer" ]]; then
    token_reponse=$current_dir/jwtbearer_token.json
    at=$( cat $token_reponse | jq -r '.access_token' )

    echo "============================"
    echo "== Impersonating the user =="
    echo "============================"
    echo "Sending request with the jwtbearer id_token"
    echo -e "curl -H ${blue}\"Authorization: Bearer $at\"${reset} -X ${blue}GET${reset} ${red}http://localhost:3000/api/user${reset}"
    
    pause
    
    curl -H "Authorization: $at" -X GET http://localhost:3000/api/user | jq

    pause
elif [[ $1 == "client_credentials" ]]; then
    token_reponse=$current_dir/client_credentials_token.json
    at=$( cat $token_reponse | jq -r '.access_token' )
else
    echo "Usage: $0 jwtbearer|client_credentials [--no-pause]"
    exit 1
fi

echo "=========================="
echo "== Get User's dashboard =="
echo "=========================="
echo "sending request with the $1 id_token"
echo -e "curl -H ${blue}\"Authorization: Bearer $at\"${reset} -X ${blue}GET${reset} ${red}http://localhost:3000/api/dashboards/uid/s6_cSu04k"${reset}

pause

curl -H "Authorization: $at" -X GET http://localhost:3000/api/dashboards/uid/s6_cSu04k | jq

pause 

echo "============================"
echo "== Get Plugin's dashboard =="
echo "============================"
echo "sending request with the $1 id_token"
echo -e "curl -H ${blue}\"Authorization: Bearer $at\"${reset} -X ${blue}GET${reset} ${red}http://localhost:3000/api/dashboards/uid/JyhVSXA4k"${reset}

pause

curl -H "Authorization: Bearer $at" -X GET http://localhost:3000/api/dashboards/uid/JyhVSXA4k | jq
