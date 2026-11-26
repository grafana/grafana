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

# Library panels the running instance can see; nothing when Grafana is unreachable.
visibleLibraryPanelCount() {
	curl -sf -u "${GRAFANA_AUTH:-admin:admin}" \
		"${GRAFANA_URL:-http://localhost:3000}/api/library-elements?perPage=1" 2>/dev/null |
		sed -n 's/.*"totalCount":[[:space:]]*\([0-9]\{1,\}\).*/\1/p'
}

# Namespace the bootstrap repository lands in, mirroring Grafana's own org mapping. Read from
# the running instance, so environment overrides count. Fails rather than guess: a wrong
# namespace would report a live repository as gone.
bootstrapNamespace() {
	command -v python3 >/dev/null 2>&1 || return 1

	curl -sf -u "${GRAFANA_AUTH:-admin:admin}" \
		"${GRAFANA_URL:-http://localhost:3000}/api/admin/settings" 2>/dev/null |
		python3 -I -c '
import json, sys

try:
    settings = json.load(sys.stdin)
except ValueError:
    sys.exit(1)

# Permission filtering drops sections and keys from an otherwise 200 response.
environment = settings.get("environment")
users = settings.get("users")
if not isinstance(environment, dict) or not isinstance(users, dict):
    sys.exit(1)
if "stack_id" not in environment:
    sys.exit(1)
if "auto_assign_org" not in users or "auto_assign_org_id" not in users:
    sys.exit(1)

if str(environment["stack_id"]).strip():
    sys.exit(1)

org_id = 1
if str(users["auto_assign_org"]).strip().lower() == "true":
    try:
        configured = int(str(users["auto_assign_org_id"]).strip())
    except ValueError:
        sys.exit(1)
    if configured > 0:
        org_id = configured

print("default" if org_id == 1 else "org-%d" % org_id)
'
}

# "gone", "present", or "unknown". The collection is read first so a 404 from an instance not
# serving the provisioning API is not mistaken for a finished deletion.
bootstrapRepositoryState() {
	local namespace base auth
	namespace=$(bootstrapNamespace) || {
		echo unknown
		return
	}
	[ -n "$namespace" ] || {
		echo unknown
		return
	}
	base="${GRAFANA_URL:-http://localhost:3000}/apis/provisioning.grafana.app/v0alpha1/namespaces/$namespace/repositories"
	auth="${GRAFANA_AUTH:-admin:admin}"

	if [ "$(curl -s -o /dev/null -w '%{http_code}' -u "$auth" "$base" 2>/dev/null)" != "200" ]; then
		echo unknown
		return
	fi

	case "$(curl -s -o /dev/null -w '%{http_code}' -u "$auth" "$base/bootstrap" 2>/dev/null)" in
	404) echo gone ;;
	200) echo present ;;
	*) echo unknown ;;
	esac
}

# Always asks: the count needs a running Grafana, and this is normally run before one exists.
confirmLibraryPanelRouting() {
	local panels reply
	panels=$(visibleLibraryPanelCount)

	echo "! This enables dualWriterMode 5 and reroutes library panel storage for the whole instance."
	if [ -n "$panels" ] && [ "$panels" -gt 0 ]; then
		echo "  The $panels library panel(s) already in this database will not be listed while it is in place."
	elif [ -z "$panels" ]; then
		echo "  Grafana is not reachable, so this database was not checked for existing library panels;"
		echo "  any held only in the legacy table will not be listed while it is in place."
	fi
	echo "  Panels created while it is in place are not listed once it is removed. Nothing is deleted."

	if [ "${BOOTSTRAP_FORCE:-}" = "1" ]; then
		return 0
	fi
	if [ ! -t 0 ]; then
		echo "  Re-run with BOOTSTRAP_FORCE=1 to accept this."
		return 1
	fi

	printf "  Continue? [y/N] "
	read -r reply
	case "$reply" in
	[yY] | [yY][eE][sS]) return 0 ;;
	*)
		echo "  Aborted."
		return 1
		;;
	esac
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

	confirmLibraryPanelRouting || exit 1

	# gdev-testdata is always created in org 1, so elsewhere the dashboards lose their datasource.
	local namespace
	namespace=$(bootstrapNamespace) || namespace=""
	if [ -n "$namespace" ] && [ "$namespace" != "default" ]; then
		echo "! Grafana's default org maps to namespace $namespace, not default."
		echo "  The dashboards would be provisioned there while gdev-testdata is created in org 1,"
		echo "  so neither panel resolves its datasource. Use an org 1 instance, or BOOTSTRAP_FORCE=1."
		[ "${BOOTSTRAP_FORCE:-}" = "1" ] || exit 1
	fi

	devDatasources
	echo -e "\xE2\x9C\x94 Setting up the provisioning bootstrap repository over devenv/provisioning-bootstrap"
	echo -e "  Library panels are served from unified storage while this config is in place."
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

    # Two steps: the deletion that clearing bootstrap_path triggers still needs these settings.
    local iniTarget
    iniTarget=$(customIniTarget)
    if [ "$iniTarget" = "../devenv/provisioning-bootstrap.ini" ]; then
        ln -s -f ../devenv/provisioning-bootstrap-cleanup.ini ../conf/custom.ini
        echo -e "    \xE2\x9C\x94 Cleared bootstrap_path; restart Grafana, then run ./setup.sh undev again to finish"
    elif [ "$iniTarget" = "../devenv/provisioning-bootstrap-cleanup.ini" ]; then
        # The restart only starts the finalizers, so confirm they finished before unlinking.
        case "$(bootstrapRepositoryState)" in
        gone)
            rm -f ../conf/custom.ini
            echo -e "    \xE2\x9C\x94 Reverting provisioning bootstrap"
            ;;
        present)
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
