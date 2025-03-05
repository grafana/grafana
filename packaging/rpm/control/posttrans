#!/bin/sh

set -e

echo "POSTTRANS: Running script"

[ -f /etc/sysconfig/grafana-server ] && . /etc/sysconfig/grafana-server

# copy config files if missing
if [ ! -f /etc/grafana/grafana.ini ]; then
  echo "POSTTRANS: Config file not found"

  if [ -f /etc/grafana/grafana.ini.rpmsave ]; then
    echo "POSTTRANS: /etc/grafana/grafana.ini.rpmsave config file found."
    mv /etc/grafana/grafana.ini.rpmsave /etc/grafana/grafana.ini
    echo "POSTTRANS: /etc/grafana/grafana.ini restored"

    if [ -f /etc/grafana/ldap.toml.rpmsave ]; then
      echo "POSTTRANS: /etc/grafana/ldap.toml.rpmsave found"
      mv /etc/grafana/ldap.toml.rpmsave /etc/grafana/ldap.toml
      echo "POSTTRANS: /etc/grafana/ldap.toml restored"
    fi

    echo "POSTTRANS: Restoring config file permissions"
    chown -Rh root:$GRAFANA_GROUP /etc/grafana/*
    chmod 755 /etc/grafana
    find /etc/grafana -type f -exec chmod 640 {} ';'
    find /etc/grafana -type d -exec chmod 755 {} ';'
  fi
fi


