#!/usr/bin/env bash

if ! which -s mysql; then
  echo "mysql must be available on your $PATH"
  exit 4
fi

mysql -u $MYSQL_USER -p$MYSQL_PASSWORD --protocol TCP -P 3306 $MYSQL_DATABASE -e "select \`id\`, migration_id from migration_log"