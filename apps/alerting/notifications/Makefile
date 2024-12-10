.PHONY: generate
generate:
	## '--crdencoding none' and '--nomanifest' are needed to avoid infinite loop while generating recursive models (see routingtree.cue)
	grafana-app-sdk generate -g ./pkg/apis --crdencoding none --postprocess
