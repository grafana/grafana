#!/bin/sh
# Creates the user and repository devenv/provisioning-gitea/repository.json points at, and pushes
# ./repo as its first commit. Started by docker-compose.yaml alongside the server it talks to.
set -eu

USERNAME=grafana
PASSWORD=grafana-devenv
REPO=devenv
BRANCH=main
API=http://127.0.0.1:3000

log() { echo "[gitea-seed] $*"; }

onExit() {
	code=$?
	[ "$code" -eq 0 ] || log "failed with exit $code"
}
trap onExit EXIT

waitForAPI() {
	attempt=0
	while [ "$attempt" -lt 180 ]; do
		if curl -sf -o /dev/null "$API/api/healthz"; then
			return 0
		fi
		attempt=$((attempt + 1))
		sleep 1
	done
	return 1
}

# The username column of `gitea admin user list`, past its header row.
userExists() {
	su git -c "gitea admin user list" | awk 'NR > 1 { print $2 }' | grep -qx "$USERNAME"
}

log "waiting for Gitea to accept requests"
if ! waitForAPI; then
	log "Gitea did not become healthy; nothing was seeded"
	exit 1
fi

if userExists; then
	log "user '$USERNAME' already exists"
else
	su git -c "gitea admin user create --username '$USERNAME' --password '$PASSWORD' --email '$USERNAME@localhost' --admin --must-change-password=false"
	log "created user '$USERNAME'"
fi

if [ "$(curl -s -o /dev/null -w '%{http_code}' -u "$USERNAME:$PASSWORD" "$API/api/v1/repos/$USERNAME/$REPO")" = "200" ]; then
	log "repository '$USERNAME/$REPO' already exists; leaving its history alone"
	exit 0
fi

curl -fsS -o /dev/null -u "$USERNAME:$PASSWORD" -X POST "$API/api/v1/user/repos" \
	-H 'Content-Type: application/json' \
	-d "{\"name\":\"$REPO\",\"default_branch\":\"$BRANCH\",\"auto_init\":false,\"private\":false}"
log "created repository '$USERNAME/$REPO'"

# The mount is read-only, so commit from a copy git can write an index into.
work=$(mktemp -d)
cp -R /gitea-seed/repo/. "$work/"
cd "$work"
git init -q -b "$BRANCH"
git add -A
git -c user.name="Grafana devenv" -c user.email="$USERNAME@localhost" \
	commit -q -m "Seed the devenv Git Sync repository"
git push -q "http://$USERNAME:$PASSWORD@127.0.0.1:3000/$USERNAME/$REPO.git" "$BRANCH"

log "pushed $(git rev-list --count HEAD) commit to $BRANCH"
log "ready: http://localhost:3002/$USERNAME/$REPO ($USERNAME / $PASSWORD)"
