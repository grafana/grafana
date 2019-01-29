#/bin/bash

PWD=$(pwd)

run() {
  duration='15m'
  url='http://localhost:3000'

  while getopts ":d:u:" o; do
    case "${o}" in
				d)
            duration=${OPTARG}
            ;;
        u)
            url=${OPTARG}
            ;;
    esac
	done
	shift $((OPTIND-1))

  docker run -t --network=host -v $PWD:/src -e URL=$url --rm -i loadimpact/k6:master run --vus 2 --duration $duration src/auth_token_test.js
}

run "$@"
