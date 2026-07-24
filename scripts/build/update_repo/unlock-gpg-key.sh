#!/usr/bin/env expect

set password [lindex $argv 0]
spawn gpg --detach-sign --armor /tmp/sign-this
expect "Enter passphrase: "
send -- "$password\r"
expect eof
