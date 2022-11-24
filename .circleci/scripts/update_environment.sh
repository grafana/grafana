#!/usr/bin/env bash
set -euo pipefail
export LOGURU_LEVEL=TRACE
export GIT_SSH_COMMAND="fn circleci ssh -o IdentitiesOnly=yes -o IdentityAgent=none"

commit_author=$(git show --format="%aN <%aE>" --quiet)

args=(
    --author "${commit_author}"
    --update "${UPDATE}"
    --release-train "latest"
    --push
)

if [ -n "${COMPONENT}" ]; then
    args+=(--component "${COMPONENT}")
fi

retry_counter=10
errcode=1
while true; do
    (( retry_counter-- )) || break

    set +e
    if fn --config-path "${JOB_ROOT}"/project/.opsninja.yaml \
          manifests update "${args[@]}" "${ENVIRONMENT_PATH}"; then
        errcode=0
        break
    else
        errcode="${?}"
    fi
    set -e
    sleep 1
done

exit $errcode
