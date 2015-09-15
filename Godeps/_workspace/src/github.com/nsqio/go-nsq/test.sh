#!/bin/bash
set -e

# a helper script to run tests

if ! which nsqd >/dev/null; then
    echo "missing nsqd binary" && exit 1
fi

if ! which nsqlookupd >/dev/null; then
    echo "missing nsqlookupd binary" && exit 1
fi

# run nsqlookupd
LOOKUP_LOGFILE=$(mktemp -t nsqlookupd.XXXXXXX)
echo "starting nsqlookupd"
echo "  logging to $LOOKUP_LOGFILE"
nsqlookupd >$LOOKUP_LOGFILE 2>&1 &
LOOKUPD_PID=$!

# run nsqd configured to use our lookupd above
rm -f *.dat
NSQD_LOGFILE=$(mktemp -t nsqlookupd.XXXXXXX)
EXTRA_ARGS="--tls-root-ca-file=./test/ca.pem"
if [[ $NSQ_DOWNLOAD == nsq-0.2.24* ]] || [[ $NSQ_DOWNLOAD == nsq-0.2.27* ]]; then
    EXTRA_ARGS=""
fi
echo "starting nsqd --data-path=/tmp --lookupd-tcp-address=127.0.0.1:4160 --tls-cert=./test/server.pem --tls-key=./test/server.key $EXTRA_ARGS"
echo "  logging to $NSQD_LOGFILE"
nsqd --data-path=/tmp --lookupd-tcp-address=127.0.0.1:4160 --tls-cert=./test/server.pem --tls-key=./test/server.key $EXTRA_ARGS >$NSQD_LOGFILE 2>&1 &
NSQD_PID=$!

sleep 0.3

cleanup() {
    echo "killing nsqd PID $NSQD_PID"
    kill -s TERM $NSQD_PID || cat $NSQD_LOGFILE
    echo "killing nsqlookupd PID $LOOKUPD_PID"
    kill -s TERM $LOOKUPD_PID || cat $LOOKUP_LOGFILE
}
trap cleanup INT TERM EXIT

go test -v -timeout 60s
