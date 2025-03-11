include ../.bingo/Variables.mk

.PHONY: all
all: dashboards

.PHONY: dashboards
dashboards: $(COG) ## Dashboards – Typescript
	@$(COG) generate --config ./dashboard-ts.yaml
