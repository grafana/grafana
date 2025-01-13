.PHONY: generate
generate:
	## --crdencoding none is needed to avoid infinite loop while generating recursive models (see routingtree.cue)
	grafana-app-sdk generate -g ./pkg/apis --crdencoding none --nomanifest --postprocess
