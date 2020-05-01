#/bin/bash

PWD=$(pwd)

run() {
  duration='15m'
  url='http://localhost:3000'
  vus='2'
  testcase='auth_token_test'
  slowQuery=''
  out=''

  while getopts ":d:u:v:c:s:o:" o; do
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
        o)  out=${OPTARG}
            ;;

    esac
	done
	shift $((OPTIND-1))

  docker run -t --network=host -v $PWD:/src -e URL=$url -e SLOW_QUERY=$slowQuery -e K6_OUT=$out --rm -i loadimpact/k6:master run --vus $vus --duration $duration src/$testcase.js
}

run "$@"
