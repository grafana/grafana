V 				= 0
Q 				= $(if $(filter 1,$V),,@)
M 				= $(shell printf "\033[34;1m▶\033[0m")


.PHONY: fmt
fmt: ; $(info $(M) running gofmt) @ ## Run go fmt on all source files
	$Q go fmt ./...

.PHONY: help
help: ; $(info) @ ## Print help info
	@grep -E '^[ a-zA-Z1-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
