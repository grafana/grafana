.PHONY: generate
generate:
	## --crdencoding none is needed to avoid infinite loop while generating recursive models'
	grafana-app-sdk generate -c . -g ./apis --crdencoding none
