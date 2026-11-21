#!/usr/bin/env bash

bulkDashboard() {

		requiresJsonnet

		COUNTER=0
		MAX=400
		while [  $COUNTER -lt $MAX ]; do
				jsonnet -o "bulk-dashboards/dashboard${COUNTER}.json" -e "local bulkDash = import 'bulk-dashboards/bulkdash.jsonnet'; bulkDash + {  uid: 'uid-${COUNTER}',  title: 'title-${COUNTER}' }"
				let COUNTER=COUNTER+1
		done

		ln -s -f ../../../devenv/bulk-dashboards/bulk-dashboards.yaml ../conf/provisioning/dashboards/custom.yaml
}

bulkFolders() {
	./bulk-folders/bulk-folders.sh "$1"
	ln -s -f ../../../devenv/bulk-folders/bulk-folders.yaml ../conf/provisioning/dashboards/bulk-folders.yaml
}

# Prints the target of conf/custom.ini when it is a symlink, nothing otherwise.
customIniTarget() {
	[ -L ../conf/custom.ini ] && readlink ../conf/custom.ini
}

# Prints the HTTP status of a GET on the bootstrap repository: 404 once it is gone, 200 while it
# is still there, anything else (including 000) when Grafana could not be asked.
bootstrapRepositoryStatus() {
	curl -s -o /dev/null -w '%{http_code}' -u "${GRAFANA_AUTH:-admin:admin}" \
		"${GRAFANA_URL:-http://localhost:3000}/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/bootstrap" \
		2>/dev/null
}

provisioningBootstrap() {
	local target
	target=$(customIniTarget)

	if [ -e ../conf/custom.ini ] || [ -L ../conf/custom.ini ]; then
		if [ "$target" != "../devenv/provisioning-bootstrap.ini" ] && [ "$target" != "../devenv/provisioning-bootstrap-cleanup.ini" ]; then
			echo "conf/custom.ini already exists and is not the provisioning bootstrap link; merge devenv/provisioning-bootstrap.ini into it by hand"
			exit 1
		fi
	fi

	devDatasources
	echo -e "\xE2\x9C\x94 Setting up the provisioning bootstrap repository over devenv/provisioning-bootstrap"
	ln -s -f ../devenv/provisioning-bootstrap.ini ../conf/custom.ini
}

scopes() {
	echo -e "\xE2\x9C\x94 Setting up scopes, scope nodes, and scope navigations"
	cd scopes
	go run scopes.go
	cd ..
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

undev() {
    echo -e "\xE2\x9C\x94 Reverting all dev provisioning"

    # Removing generated dashboard files from bulk-dashboards
    rm -f bulk-dashboards/dashboard*.json
    echo -e "    \xE2\x9C\x94 Reverting bulk-dashboards provisioning"

    # Removing generated folders from bulk-folders
    rm -rf bulk-folders/Bulk\ Folder*
    echo -e "    \xE2\x9C\x94 Reverting bulk-folders provisioning"

    # Removing scopes, scope nodes, and scope navigations
    cd scopes
    go run scopes.go -clean
    cd ..
    echo -e "    \xE2\x9C\x94 Deleting scopes, scope nodes, and scope navigations"

    # Removing the provisioning bootstrap config, only when it is ours. Clearing bootstrap_path
    # deletes the repository on the next start, and that deletion needs the unified storage
    # settings still in place, so the first run swaps to a config without bootstrap_path and the
    # second run, after a restart, removes the link.
    local iniTarget
    iniTarget=$(customIniTarget)
    if [ "$iniTarget" = "../devenv/provisioning-bootstrap.ini" ]; then
        ln -s -f ../devenv/provisioning-bootstrap-cleanup.ini ../conf/custom.ini
        echo -e "    \xE2\x9C\x94 Cleared bootstrap_path; restart Grafana, then run ./setup.sh undev again to finish"
    elif [ "$iniTarget" = "../devenv/provisioning-bootstrap-cleanup.ini" ]; then
        # Deleting the repository is asynchronous: the restart only starts its finalizers, which
        # need these settings to reach the library panel. Unlinking while that is pending strands
        # the repository on a finalizer it can no longer satisfy, so confirm it is gone first.
        case "$(bootstrapRepositoryStatus)" in
        404)
            rm -f ../conf/custom.ini
            echo -e "    \xE2\x9C\x94 Reverting provisioning bootstrap"
            ;;
        200)
            echo -e "    ! Bootstrap repository still present; keeping conf/custom.ini so its finalizers can finish."
            echo -e "      Re-run once it is gone. If it stays, see devenv/provisioning-bootstrap/README.md."
            ;;
        *)
            echo -e "    ! Could not ask Grafana whether the bootstrap repository is gone; keeping conf/custom.ini."
            echo -e "      Start Grafana (make run) and re-run, so the deletion finishes before the settings go."
            ;;
        esac
    fi

    # Removing the symlinks
    rm -f ../conf/provisioning/dashboards/custom.yaml
    rm -f ../conf/provisioning/dashboards/bulk-folders.yaml
    rm -f ../conf/provisioning/dashboards/dev.yaml
    rm -f ../conf/provisioning/datasources/custom.yaml
    rm -f ../conf/provisioning/datasources/dev.yaml
}

usage() {
	echo -e "\n"
	echo "Usage:"
	echo "  bulk-dashboards                      - provision 400 dashboards"
	echo "  bulk-folders [folders] [dashboards]  - provision many folders with dashboards"
	echo "  bulk-folders                         - provision 200 folders with 3 dashboards in each"
	echo "  scopes                               - provision scopes, scope nodes, and scope navigations"
	echo "  provisioning-bootstrap               - provision devenv/provisioning-bootstrap via bootstrap_path (writes conf/custom.ini)"
	echo "  no args                              - provision core datasources and dev dashboards"
	echo "  undev                                - removes any provisioning done by the setup.sh"
}

main() {
	echo -e "----------------------------------------------------------------------------"
	echo -e "This script sets up provisioning for dev datasources, dashboards and folders"
	echo -e "----------------------------------------------------------------------------"
	echo -e "\n"

	local cmd=$1
  local arg1=$2

	if [[ $cmd == "bulk-dashboards" ]]; then
		bulkDashboard
	elif [[ $cmd == "bulk-folders" ]]; then
		bulkFolders "$arg1"
	elif [[ $cmd == "scopes" ]]; then
		scopes
	elif [[ $cmd == "provisioning-bootstrap" ]]; then
		provisioningBootstrap
	elif [[ $cmd == "undev" ]]; then
 	   undev
	else
		devDashboards
		devDatasources
	fi

  if [[ -z "$cmd" ]]; then
		usage
	fi

}

main "$@"
