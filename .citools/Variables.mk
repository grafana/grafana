TOOLS_DIR := $(shell cd $(dir $(lastword $(MAKEFILE_LIST))) && pwd)
TOOL_SRC_DIR := $(TOOLS_DIR)/src
TOOL_CACHE := $(TOOLS_DIR)/.tool-cache
# Generated tool paths

# Tool: bra
bra = $(shell \
  if [ ! -f $(TOOL_CACHE)/bra.path ]; then \
    (cd $(TOOL_SRC_DIR)/bra && GOWORK=off go tool -n github.com/unknwon/bra > $(TOOL_CACHE)/bra.path); \
  fi; \
  cat $(TOOL_CACHE)/bra.path \
)

# Tool: cog
cog = $(shell \
  if [ ! -f $(TOOL_CACHE)/cog.path ]; then \
    (cd $(TOOL_SRC_DIR)/cog && GOWORK=off go tool -n github.com/grafana/cog/cmd/cli > $(TOOL_CACHE)/cog.path); \
  fi; \
  cat $(TOOL_CACHE)/cog.path \
)

# Tool: cue
cue = $(shell \
  if [ ! -f $(TOOL_CACHE)/cue.path ]; then \
    (cd $(TOOL_SRC_DIR)/cue && GOWORK=off go tool -n cuelang.org/go/cmd/cue > $(TOOL_CACHE)/cue.path); \
  fi; \
  cat $(TOOL_CACHE)/cue.path \
)

# Tool: golangci-lint
golangci-lint = $(shell \
  if [ ! -f $(TOOL_CACHE)/golangci-lint.path ]; then \
    (cd $(TOOL_SRC_DIR)/golangci-lint && GOWORK=off go tool -n github.com/golangci/golangci-lint/v2/cmd/golangci-lint > $(TOOL_CACHE)/golangci-lint.path); \
  fi; \
  cat $(TOOL_CACHE)/golangci-lint.path \
)

# Tool: jb
jb = $(shell \
  if [ ! -f $(TOOL_CACHE)/jb.path ]; then \
    (cd $(TOOL_SRC_DIR)/jb && GOWORK=off go tool -n github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb > $(TOOL_CACHE)/jb.path); \
  fi; \
  cat $(TOOL_CACHE)/jb.path \
)

# Tool: lefthook
lefthook = $(shell \
  if [ ! -f $(TOOL_CACHE)/lefthook.path ]; then \
    (cd $(TOOL_SRC_DIR)/lefthook && GOWORK=off go tool -n github.com/evilmartians/lefthook > $(TOOL_CACHE)/lefthook.path); \
  fi; \
  cat $(TOOL_CACHE)/lefthook.path \
)

# Tool: swagger
swagger = $(shell \
  if [ ! -f $(TOOL_CACHE)/swagger.path ]; then \
    (cd $(TOOL_SRC_DIR)/swagger && GOWORK=off go tool -n github.com/go-swagger/go-swagger/cmd/swagger > $(TOOL_CACHE)/swagger.path); \
  fi; \
  cat $(TOOL_CACHE)/swagger.path \
)
