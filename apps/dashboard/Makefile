.PHONY: generate
generate:
	@grafana-app-sdk generate \
		--source=./kinds/ \
		--gogenpath=../../pkg/apis \
		--tsgenpath=../../packages/grafana-schema/src/schema \
		--grouping=group \
		--defencoding=none \
		--genoperatorstate=false \
		--noschemasinmanifest
