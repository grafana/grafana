#/bin/bash

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

defaultDashboards() {
    echo "not implemented yet"
}

defaultDatasources() {
    echo "setting up all default datasources using provisioning"

    ln -s -f -r ./datasources/default/default.yaml ../conf/provisioning/datasources/custom.yaml
}

usage() {
	echo -e "install.sh\n\tThis script installs my basic setup for a debian laptop\n"
	echo "Usage:"
	echo "  bulk-dashboards                     - create and provisioning 400 dashboards"
    echo "  default-datasources                 - provisiong all core datasources"
}

main() {
	local cmd=$1

	if [[ -z "$cmd" ]]; then
		usage
		exit 1
	fi

	if [[ $cmd == "bulk-dashboards" ]]; then
		bulkDashboard
    elif [[ $cmd == "default-datasources" ]]; then
		defaultDatasources
    elif [[ $cmd == "default-dashboards" ]]; then
		bulkDashboard
	else
		usage
	fi
}

main "$@"
