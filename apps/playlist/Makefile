.PHONY: generate
generate:
	@grafana-app-sdk generate -g ./pkg/apis --grouping=group --postprocess
	# HACK: Clean up generated CRD files.
	# TODO: The SDK currently omits generating the manifest Go file with `--defencoding=none`,
	# which we would normally use here to skip generating the CRD files.
	# This needs to be addressed.
	@rm -rf definitions
