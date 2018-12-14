#!/usr/bin/env expect

set password [lindex $argv 0]
spawn aptly publish repo grafana filesystem:repo:grafana
expect "Enter passphrase: "
send -- "$password\r"
expect eof
