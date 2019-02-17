#!/usr/bin/env expect

set password [lindex $argv 0]
spawn gpg --detach-sign --armor /rpm-repo/repodata/repomd.xml
expect "Enter passphrase: "
send -- "$password\r"
expect eof
