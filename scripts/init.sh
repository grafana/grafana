#!/bin/sh
### BEGIN INIT INFO
# Provides:          grafana
# Required-Start:    $local_fs $remote_fs $network
# Required-Stop:     $local_fs $remote_fs $network
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Starts grafana at startup
# Description:       Starts grafana at startup
### END INIT INFO


# Documentation available at
# http://refspecs.linuxfoundation.org/LSB_3.1.0/LSB-Core-generic/LSB-Core-generic/iniscrptfunc.html
# Debian provides some extra functions though
. /lib/lsb/init-functions

DAEMON_NAME="grafana"
DAEMON_USER="grafana"
DAEMON_PATH="/opt/grafana/current/grafana"
DAEMON_OPTS="web"
DAEMON_PWD="/opt/grafana/current"
DAEMON_PID="/var/run/${DAEMON_NAME}.pid"
DAEMON_NICE=0
DAEMON_LOG='/var/log/grafana/grafana.log'

[ -r "/etc/default/${DAEMON_NAME}" ] && . "/etc/default/${DAEMON_NAME}"

do_start() {
  local result

        pidofproc -p "${DAEMON_PID}" "${DAEMON_PATH}" > /dev/null
        if [ $? -eq 0 ]; then
                log_warning_msg "${DAEMON_NAME} is already started"
                result=0
        else
                log_daemon_msg "Starting ${DAEMON_DESC}" "${DAEMON_NAME}"
                touch "${DAEMON_LOG}"
                chown $DAEMON_USER "${DAEMON_LOG}"
                chmod u+rw "${DAEMON_LOG}"
                if [ -z "${DAEMON_USER}" ]; then
                        start-stop-daemon --start --quiet --oknodo --background \
                                --nicelevel $DAEMON_NICE \
                                --chdir "${DAEMON_PWD}" \
                                --pidfile "${DAEMON_PID}" --make-pidfile \
                                --exec "${DAEMON_PATH}" -- $DAEMON_OPTS
                        result=$?
                else
                        start-stop-daemon --start --quiet --oknodo --background \
                                --nicelevel $DAEMON_NICE \
                                --chdir "${DAEMON_PWD}" \
                                --pidfile "${DAEMON_PID}" --make-pidfile \
                                --chuid "${DAEMON_USER}" \
                                --exec  "${DAEMON_PATH}" -- $DAEMON_OPTS
                        result=$?
                fi
                log_end_msg $result
        fi
        return $result
}

do_stop() {
        local result

        pidofproc -p "${DAEMON_PID}" "${DAEMON_PATH}" > /dev/null
        if [ $? -ne 0 ]; then
                log_warning_msg "${DAEMON_NAME} is not started"
                result=0
        else
                log_daemon_msg "Stopping ${DAEMON_DESC}" "${DAEMON_NAME}"
                killproc -p "${DAEMON_PID}" "${DAEMON_PATH}"
                result=$?
                log_end_msg $result
                rm "${DAEMON_PID}"
        fi
        return $result
}

do_restart() {
        local result
        do_stop
        result=$?
        if [ $result = 0 ]; then
                do_start
                result=$?
        fi
        return $result
}

do_status() {
        local result
        status_of_proc -p "${DAEMON_PID}" "${DAEMON_PATH}" "${DAEMON_NAME}"
        result=$?
        return $result
}

do_usage() {
        echo $"Usage: $0 {start | stop | restart | status}"
        exit 1
}

case "$1" in
start)   do_start;   exit $? ;;
stop)    do_stop;    exit $? ;;
restart) do_restart; exit $? ;;
status)  do_status;  exit $? ;;
*)       do_usage;   exit  1 ;;
esac
