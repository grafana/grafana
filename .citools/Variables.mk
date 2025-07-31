# Generated tool paths
tools_dir := $(shell cd $(dir $(lastword $(MAKEFILE_LIST))) && pwd)
src_dir := $(tools_dir)/src

# Due to a race condition, after initial call to `go tool` golang may report a wrong binary location pointing to the invalid `/tmp/go-buildXXX` directory
define compile_tool
$(shell \
  (cd $(src_dir)/$(1) \
  && GOWORK=off go tool -n $(2) > /dev/null \
  && GOWORK=off go tool -n $(2)) | sed 's/^[[:space:]]*//g'; \
)
endef


# Tool: "air"
air = "$(call compile_tool,air,github.com/air-verse/air)"

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
