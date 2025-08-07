#!/bin/sh
# This script tests the run.sh script for Grafana Docker image.

set -e

ERRORS=0    # count of errors
TIMEOUT=60  # seconds to wait for startup

# Helper functions

ok() {
  echo "OK: $1"
}

error() {
  echo "ERROR: $1"
  ERRORS=$((ERRORS + 1))
}

run_error_check() {
  if [ -s "$run_error_log" ]; then
    echo "WARN: run.sh encountered startup errors:"
    cat "$run_error_log"
  fi
}

exit_with_msg() {
  echo "$1"
  exit 1
}

echo "> Setting up test environment"

mkdir -p "/tmp/grafana_test_run"
trap "rm -rf /tmp/grafana_test_run" EXIT

# GF_PATHS_PLUGINS is created by run.sh if it does not exist
export GF_PATHS_PLUGINS="/tmp/grafana_test_run/plugins"

# AWS credentials file is created by run.sh using GF_AWS_PROFILES and GF_AWS_* environment variables.
export GF_AWS_PROFILES="profile1 profile2"
export GF_AWS_profile1_ACCESS_KEY_ID="AKIAEXAMPLE1"
export GF_AWS_profile1_SECRET_ACCESS_KEY="secret1"
export GF_AWS_profile1_REGION="us-west-1"
export GF_AWS_profile2_ACCESS_KEY_ID="AKIAEXAMPLE2"
export GF_AWS_profile2_SECRET_ACCESS_KEY="secret2"
export GF_AWS_profile2_REGION="us-west-2"
mkdir -p "$GF_PATHS_HOME/.aws"
aws_credentials_file="$GF_PATHS_HOME/.aws/credentials"
# Create expected AWS credentials file content
expected_aws_credentials="/tmp/expected_aws_credentials"
cat <<EOF > "$expected_aws_credentials"
[profile1]
aws_access_key_id = ${GF_AWS_profile1_ACCESS_KEY_ID}
aws_secret_access_key = ${GF_AWS_profile1_SECRET_ACCESS_KEY}
region = ${GF_AWS_profile1_REGION}
[profile2]
aws_access_key_id = ${GF_AWS_profile2_ACCESS_KEY_ID}
aws_secret_access_key = ${GF_AWS_profile2_SECRET_ACCESS_KEY}
region = ${GF_AWS_profile2_REGION}
EOF

# __FILE variables are used by run.sh to read content from files into environment variables
export GF_FOO__FILE="/tmp/foo_file"
cat <<EOF > "$GF_FOO__FILE"
I am a file
to be read as environment variable
EOF

echo "> Starting run.sh"
# The grafana_pid_file is used to determine when Grafana has started
grafana_pid_file="/tmp/grafana_test_run/grafana.pid"
# Errors will be logged to run_error_log file
run_error_log="/tmp/grafana_test_run/run_error.log"
/run.sh --pidfile "$grafana_pid_file" 1>/dev/null 2>"$run_error_log" &
pid=$!
trap "rm -f $run_error_log" EXIT
trap run_error_check EXIT
trap "kill $pid" EXIT

echo -n "> Waiting for Grafana to start "
SECONDS=0
# Startup is considered successful when the grafana_pid_file is created
until [ -f "$grafana_pid_file" ]; do
  # Check if timeout is reached
  test $(( SECONDS++ )) -gt "$TIMEOUT" && exit_with_msg " timeout"
  # Check if run.sh script is still running
  test ! -d "/proc/$pid" && exit_with_msg " failed"
  echo -n .
  sleep 1
done
echo " done"

echo "> Testing results"

# Ensure no errors were logged during startup
test ! -s "$run_error_log" &&\
  ok "run.sh started without errors" ||\
  error "run.sh encountered errors during startup"

# Ensure plugins directory was created
test -d "$GF_PATHS_PLUGINS" &&\
  ok "$GF_PATHS_PLUGINS directory exists" ||\
  error "$GF_PATHS_PLUGINS directory does not exist"

# Ensure aws credentials file was created
test -f "$aws_credentials_file" &&\
  ok "$aws_credentials_file file exists" ||\
  error "$aws_credentials_file file does not exist"

# Ensure aws credentials file content matches expected
if diff "$expected_aws_credentials" "$aws_credentials_file" &> /dev/null; then
  ok "$aws_credentials_file content matches expected"
else
  error "$aws_credentials_file content does not match expected"
  diff "$expected_aws_credentials" "$aws_credentials_file"
fi

# Ensure aws credentials file permissions are set to 600
stat -c "%a" "$aws_credentials_file" | grep -q "600" &&\
  ok "$aws_credentials_file file permissions are 600" ||\
  error "$aws_credentials_file file permissions are not 600"

# Ensure GF_FOO variable was set correctly to the content of the file from GF_FOO__FILE
# Would be prefferable to use grep -z to handle null-terminated strings, but it is not available in busybox grep
test -n "$(grep -ao $'GF_FOO=I am a file\nto be read as environment variable' /proc/$pid/environ)" &&\
  ok "GF_FOO variable is set correctly in the environment" ||\
  error "GF_FOO variable is not set correctly from file"

# Ensure HOME variable is set to GF_PATHS_HOME
# Would be prefferable to use grep -z to handle null-terminated strings, but it is not available in busybox grep
test -n "$(grep -ao "HOME=$GF_PATHS_HOME" /proc/$pid/environ)" &&\
  ok "HOME variable is set correctly in the environment" ||\
  error "HOME variable is not set correctly in the environment"

echo "> Testing complete"
result="$([ "$ERRORS" -eq 0 ] && echo "passed" || echo "failed")"
echo "> Tests $result, errors: $ERRORS"
