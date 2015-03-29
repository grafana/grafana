#! /usr/bin/env bash

# chkconfig: 2345 80 05
# description: Grafana web server & backend
# processname: grafana
# config: /etc/grafana/grafana.ini
# pidfile: /var/run/grafana.pid

### BEGIN INIT INFO
# Provides:          grafana
# Required-Start:    $all
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start grafana at boot time
### END INIT INFO

#  tested on
#  1. New lsb that define start-stop-daemon
#  3. Centos with initscripts package installed

if [ -r /lib/lsb/init-functions ]; then
    source /lib/lsb/init-functions
fi

DAEMON_NAME="grafana"
DAEMON_USER="grafana"
DAEMON_PATH="/opt/grafana/current/grafana"
DAEMON_OPTS="--config=/etc/grafana/grafana.ini web"
DAEMON_PWD="/opt/grafana/current"
DAEMON_PID="/var/run/${DAEMON_NAME}.pid"
DAEMON_NICE=0
DAEMON_LOG='/var/log/grafana/grafana.log'

# If the daemon is not there, then exit.
[ -x $DAEMON_PATH ] || exit 5

if [ "x$STDOUT" == "x" ]; then
    STDOUT=/tmp/grafana.log
fi

function pidofproc() {
    if [ $# -ne 3 ]; then
        echo "Expected three arguments, e.g. $0 -p pidfile daemon-name"
    fi

    pid=`pgrep -f $3`
    local pidfile=`cat $2`

    if [ "x$pidfile" == "x" ]; then
        return 1
    fi

    if [ "x$pid" != "x" -a "$pidfile" == "$pid" ]; then
        return 0
    fi

    return 1
}

function killproc() {
    if [ $# -ne 3 ]; then
        echo "Expected three arguments, e.g. $0 -p pidfile signal"
    fi

    pid=`cat $2`

    kill -s $3 $pid
}

function log_failure_msg() {
    echo "$@" "[ FAILED ]"
}

function log_success_msg() {
    echo "$@" "[ OK ]"
}

do_start() {
  cd $DAEMON_PWD

  # Checked the PID file exists and check the actual status of process
  if [ -e $DAEMON_PID ]; then
    pidofproc -p $DAEMON_PID $DAEMON_PATH > /dev/null 2>&1 && status="0" || status="$?"
    # If the status is SUCCESS then don't need to start again.
    if [ "x$status" = "x0" ]; then
      log_failure_msg "$DAEMON_NAME process is running"
      exit 1 # Exit
    fi
  fi
  # Start the daemon.
  log_success_msg "Starting the process" "$DAEMON_NAME"

  # Start the daemon with the help of start-stop-daemon
  # Log the message appropriately
  if which start-stop-daemon > /dev/null 2>&1; then
    start-stop-daemon \
      --start --quiet --oknodo --background \
      --nicelevel $DAEMON_NICE \
      --chdir "${DAEMON_PWD}" \
      --pidfile "${DAEMON_PID}" --make-pidfile \
      --chuid "${DAEMON_USER}" \
      --exec  "${DAEMON_PATH}" -- $DAEMON_OPTS
    result=$?
  else
    touch ${DAEMON_PID}
    chown $DAEMON_USER "${DAEMON_PID}"
    #daemon --user $DAEMON_USER --pidfile $DAEMON_PID nohup $DAEMON_PATH $DAEMON_OPTS
    su -s /bin/sh -c "nohup ${DAEMON_PATH} --pidfile=${DAEMON_PID} ${DAEMON_OPTS} >> $STDOUT 3>&1 &" $DAEMON_USER
  fi

  log_success_msg "$DAEMON_NAME process was started"
}

do_stop() {
  local result

  pidofproc -p "${DAEMON_PID}" "${DAEMON_PATH}" > /dev/null
  if [ $? -ne 0 ]; then
    log_failure_msg "${DAEMON_NAME} is not started"
    result=0
  else
    log_success_msg "Stopping ${DAEMON_NAME}"
    killproc -p "${DAEMON_PID}" SIGTERM
    result=$?
    if [ $result = 0 ]; then
      log_success_msg "Stopped ${DAEMON_NAME}"
      rm "${DAEMON_PID}"
    fi
  fi

  return $result
}

do_restart() {
  local result
  do_stop
  result=$?
  sleep 2
  if [ $result = 0 ]; then
    do_start
    result=$?
  fi
  return $result
}

do_status() {
  if [ -e $DEAMON_PID ]; then
    pidofproc -p "${DAEMON_PID}" "${DAEMON_PATH}" > /dev/null
    if [ $? -ne 0 ]; then
      log_failure_msg "$DAEMON_NAME Process is not running"
      exit 1
    else
      log_success_msg "$DAEMON_NAME Process is running"
      exit 0
    fi
  else
    log_failure_msg "$DAEMON_NAME Process is not running"
    exit 3
  fi
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
