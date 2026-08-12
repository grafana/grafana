#!/usr/bin/env bash

PWD=$(pwd)

run() {
  duration='15m'
  url='http://localhost:3000'
  vus='2'
  testcase='auth_token_test'
  slowQuery=''
  out=''
  apiKey=''

  while getopts ":d:u:v:c:s:o:k:" o; do
    case "${o}" in
        d)
            duration=${OPTARG}
            ;;
        u)
            url=${OPTARG}
            ;;
        v)
            vus=${OPTARG}
            ;;
        c)
            testcase=${OPTARG}
            ;;
        s)
            slowQuery=${OPTARG}
            ;;
        o)  
            out=${OPTARG}
            ;;
        k)
            apiKey=${OPTARG}
            ;;

    esac
	done
	shift $((OPTIND-1))

  docker run -t --network=host -v $PWD:/src -e URL=$url -e SLOW_QUERY=$slowQuery -e K6_OUT=$out -e API_KEY=$apiKey --rm -i loadimpact/k6:master run --vus $vus --duration $duration /src/$testcase.js
}

run "$@"
