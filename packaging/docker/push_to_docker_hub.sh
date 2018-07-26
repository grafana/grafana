#!/bin/sh

_grafana_tag=$1
_grafana_version=$(echo ${_grafana_tag} | cut -d "v" -f 2)

if [ "$_grafana_version" != "" ]; then
	echo "pushing grafana/grafana:${_grafana_version}"
	docker push grafana/grafana:${_grafana_version}

	if echo "$_grafana_version" | grep -viqF beta; then
		echo "pushing grafana/grafana:latest"
		docker push grafana/grafana:latest
	fi
else
	echo "pushing grafana/grafana:master"
	docker push grafana/grafana:master
fi
