#!/bin/bash

requiresJsonnet() {
		if ! type "jsonnet" > /dev/null; then
				echo "you need you install jsonnet to run this script"
				echo "follow the instructions on https://github.com/google/jsonnet"
				exit 1
		fi
}

setup() {
	STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://admin:admin@grafana.loc/api/alert-notifications/1)
  if [ $STATUS -eq 200 ]; then
    echo "Email already exists, skipping..."
  else
		curl -H "Content-Type: application/json" \
		-d '{
			"name": "Email",
			"type":  "email",
			"isDefault": false,
			"sendReminder": false,
			"uploadImage": true,
			"settings": {
				"addresses": "user@test.com"
			}
		}' \
		http://admin:admin@grafana.loc/api/alert-notifications
  fi

	STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://admin:admin@grafana.loc/api/alert-notifications/2)
  if [ $STATUS -eq 200 ]; then
    echo "Slack already exists, skipping..."
  else
		curl -H "Content-Type: application/json" \
		-d '{
			"name": "Slack",
			"type":  "slack",
			"isDefault": false,
			"sendReminder": false,
			"uploadImage": true
		}' \
		http://admin:admin@grafana.loc/api/alert-notifications
  fi
}

slack() {
	enabled=true
	url=''
	remind=false
	remindEvery='10m'

	while getopts ":e:u:dr" o; do
    case "${o}" in
				e)
            remindEvery=${OPTARG}
            ;;
				u)
            url=${OPTARG}
            ;;
				d)
            enabled=false
            ;;
				r)
            remind=true
            ;;
    esac
	done
	shift $((OPTIND-1))

	curl -X PUT \
		-H "Content-Type: application/json" \
		-d '{
			"id": 2,
			"name": "Slack",
			"type":  "slack",
			"isDefault": '$enabled',
			"sendReminder": '$remind',
			"frequency": "'$remindEvery'",
			"uploadImage": true,
			"settings": {
				"url": "'$url'"
			}
		}' \
		http://admin:admin@grafana.loc/api/alert-notifications/2
}

provision() {
	alerts=1
	condition=65
	while getopts ":a:c:" o; do
    case "${o}" in
        a)
            alerts=${OPTARG}
            ;;
				c)
            condition=${OPTARG}
            ;;
    esac
	done
	shift $((OPTIND-1))

	requiresJsonnet

	find grafana/provisioning/dashboards/alerts -maxdepth 1 -name 'alert*.json' -delete
	jsonnet -m grafana/provisioning/dashboards/alerts grafana/provisioning/alerts.jsonnet --ext-code alerts=$alerts --ext-code condition=$condition
}

pause() {
	curl -H "Content-Type: application/json" \
  -d '{"paused":true}' \
  http://admin:admin@grafana.loc/api/admin/pause-all-alerts
}

unpause() {
	curl -H "Content-Type: application/json" \
  -d '{"paused":false}' \
  http://admin:admin@grafana.loc/api/admin/pause-all-alerts
}

usage() {
	echo -e "Usage: ./alerts.sh COMMAND [OPTIONS]\n"
	echo -e "Commands"
	echo -e "  setup\t\t creates default alert notification channels"
	echo -e "  slack\t\t configure slack notification channel"
	echo -e "    [-d]\t\t\t disable notifier, default enabled"
	echo -e "    [-u]\t\t\t url"
	echo -e "    [-r]\t\t\t send reminders"
	echo -e "    [-e <remind every>]\t\t default 10m\n"
	echo -e "  provision\t provision alerts"
	echo -e "    [-a <alert rule count>]\t default 1"
	echo -e "    [-c <condition value>]\t default 65\n"
	echo -e "  pause\t\t pause all alerts"
	echo -e "  unpause\t unpause all alerts"
}

main() {
	local cmd=$1

	if [[ $cmd == "setup" ]]; then
		setup
	elif [[ $cmd == "slack" ]]; then
		slack "${@:2}"
	elif [[ $cmd == "provision" ]]; then
		provision "${@:2}"
	elif [[ $cmd == "pause" ]]; then
		pause
	elif [[ $cmd == "unpause" ]]; then
		unpause
	fi

  if [[ -z "$cmd" ]]; then
		usage
	fi
}

main "$@"
