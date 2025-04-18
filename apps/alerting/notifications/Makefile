.PHONY: generate
generate:
	## --defencoding=none is needed to avoid infinite loop while generating recursive models (see routingtree.cue)
	@grafana-app-sdk generate \
		--gogenpath=./pkg/apis \
		--source=./kinds/ \
		--defencoding=none \
		--noschemasinmanifest
