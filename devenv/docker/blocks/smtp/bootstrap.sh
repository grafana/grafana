#!/bin/sh

set -u

# User params
USER_PARAMS=$@

# Internal params
RUN_CMD="snmpd -f ${USER_PARAMS}"

#######################################
# Echo/log function
# Arguments:
#   String: value to log
#######################################
log() {
  if [[ "$@" ]]; then echo "[`date +'%Y-%m-%d %T'`] $@";
  else echo; fi
}

# Launch
log $RUN_CMD
$RUN_CMD

# Exit immediately in case of any errors or when we have interactive terminal
if [[ $? != 0 ]] || test -t 0; then exit $?; fi
log
