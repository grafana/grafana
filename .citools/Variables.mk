# Generated tool paths

# Tool: bra
bra = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/bra.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/bra && GOWORK=off go tool -n github.com/unknwon/bra > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/bra.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/bra.path \
)

# Tool: cog
cog = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cog.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/cog && GOWORK=off go tool -n github.com/grafana/cog/cmd/cli > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cog.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cog.path \
)

# Tool: cue
cue = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cue.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/cue && GOWORK=off go tool -n cuelang.org/go/cmd/cue > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cue.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/cue.path \
)

# Tool: golangci-lint
golangci-lint = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/golangci-lint.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/golangci-lint && GOWORK=off go tool -n github.com/golangci/golangci-lint/v2/cmd/golangci-lint > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/golangci-lint.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/golangci-lint.path \
)

# Tool: jb
jb = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/jb.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/jb && GOWORK=off go tool -n github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/jb.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/jb.path \
)

# Tool: lefthook
lefthook = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/lefthook.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/lefthook && GOWORK=off go tool -n github.com/evilmartians/lefthook > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/lefthook.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/lefthook.path \
)

# Tool: swagger
swagger = $(shell \
  if [ ! -f /Users/denis/GolandProjects/grafana/.citools/.tool-cache/swagger.path ]; then \
    (cd /Users/denis/GolandProjects/grafana/.citools/src/swagger && GOWORK=off go tool -n github.com/go-swagger/go-swagger/cmd/swagger > /Users/denis/GolandProjects/grafana/.citools/.tool-cache/swagger.path); \
  fi; \
  cat /Users/denis/GolandProjects/grafana/.citools/.tool-cache/swagger.path \
)
