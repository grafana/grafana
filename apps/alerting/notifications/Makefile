.PHONY: generate
generate:
	## --crdencoding none is needed to avoid infinite loop while generating recursive models (see routingtree.cue)
	grafana-app-sdk generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--defencoding=none \
		--noschemasinmanifest \
		--postprocess
