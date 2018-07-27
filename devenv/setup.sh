#!/bin/bash

bulkDashboard() {

		requiresJsonnet

		COUNTER=0
		MAX=400
		while [  $COUNTER -lt $MAX ]; do
				jsonnet -o "dashboards/bulk-testing/dashboard${COUNTER}.json" -e "local bulkDash = import 'dashboards/bulk-testing/bulkdash.jsonnet'; bulkDash + {  uid: 'uid-${COUNTER}',  title: 'title-${COUNTER}' }"
				let COUNTER=COUNTER+1
		done

		ln -s -f -r ./dashboards/bulk-testing/bulk-dashboards.yaml ../conf/provisioning/dashboards/custom.yaml
}

requiresJsonnet() {
		if ! type "jsonnet" > /dev/null; then
				echo "you need you install jsonnet to run this script"
				echo "follow the instructions on https://github.com/google/jsonnet"
				exit 1
		fi
}

devDashboards() {
		echo -e "\xE2\x9C\x94 Setting up all dev dashboards using provisioning"
		ln -s -f ../../../devenv/dashboards.yaml ../conf/provisioning/dashboards/dev.yaml
}

devDatasources() {
		echo -e "\xE2\x9C\x94 Setting up all dev datasources using provisioning"

		ln -s -f ../../../devenv/datasources.yaml ../conf/provisioning/datasources/dev.yaml
}

usage() {
	echo -e "\n"
	echo "Usage:"
	echo "  bulk-dashboards                     - create and provisioning 400 dashboards"
	echo "  no args                             - provisiong core datasources and dev dashboards"
}

main() {
	echo -e "------------------------------------------------------------------"
	echo -e "This script setups provisioning for dev datasources and dashboards"
	echo -e "------------------------------------------------------------------"
	echo -e "\n"

	local cmd=$1

	if [[ $cmd == "bulk-dashboards" ]]; then
		bulkDashboard
	else
		devDashboards
		devDatasources
	fi

  if [[ -z "$cmd" ]]; then
		usage
	fi

}

main "$@"
