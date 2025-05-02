# Generated tool paths
tools_dir := $(shell cd $(dir $(lastword $(MAKEFILE_LIST))) && pwd)
tools_cache_dir := $(tools_dir)/.tool-cache
src_dir := $(tools_dir)/src

define compile_tool
$(shell \
  if [ ! -d $(tools_cache_dir) ]; then \
    mkdir -p $(tools_cache_dir); \
  fi; \
  if [ ! -f $(tools_cache_dir)/$(1).path ]; then \
    (cd $(src_dir)/$(1) && GOWORK=off go tool -n $(2) > $(tools_cache_dir)/$(1).path); \
  fi; \
  cat $(tools_cache_dir)/$(1).path | sed 's/^[[:space:]]*//g' \
)
endef


# Tool: "bra"
bra = "$(call compile_tool,bra,github.com/unknwon/bra)"

# Tool: "cog"
cog = "$(call compile_tool,cog,github.com/grafana/cog/cmd/cli)"

# Tool: "cue"
cue = "$(call compile_tool,cue,cuelang.org/go/cmd/cue)"

# Tool: "golangci-lint"
golangci-lint = "$(call compile_tool,golangci-lint,github.com/golangci/golangci-lint/v2/cmd/golangci-lint)"

# Tool: "jb"
jb = "$(call compile_tool,jb,github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb)"

# Tool: "lefthook"
lefthook = "$(call compile_tool,lefthook,github.com/evilmartians/lefthook)"

# Tool: "swagger"
swagger = "$(call compile_tool,swagger,github.com/go-swagger/go-swagger/cmd/swagger)"
