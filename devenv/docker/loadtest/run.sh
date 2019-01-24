#/bin/bash

PWD=$(pwd)

run() {
  duration='15m'

  while getopts ":d:" o; do
    case "${o}" in
				d)
            duration=${OPTARG}
            ;;
    esac
	done
	shift $((OPTIND-1))

  docker run -t --network=host -v $PWD:/src --rm -i loadimpact/k6:master run --vus 2 --duration $duration src/auth_token_test.js
}

run "$@"
