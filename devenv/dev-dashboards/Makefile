DASHBOARD_FILES = $(shell find ./ -type f -name '*.json')
DASHBOARDS = $(patsubst ./%, %, $(DASHBOARD_FILES))

gen.libsonnet: $(DASHBOARDS)
	@rm $@ 2>/dev/null || true
	@echo '{' >> $@
	@echo "\tgrafanaDashboardFolder:: 'dev-dashboards', " >> $@
	@echo '\tgrafanaDashboards+:: {' >> $@
	@for dashboard in $(filter-out $(lastword $(DASHBOARDS)), $(DASHBOARDS)); do \
		echo "\t\t'$$(basename $$dashboard)': (import '$$dashboard')," >> $@; \
	done
	@echo "\t\t'$(notdir $(lastword $(DASHBOARDS)))': (import '$(lastword $(DASHBOARDS))')" >> $@;
	@echo '\t}' >> $@
	@echo '}' >> $@
	@echo "$(words $(DASHBOARDS)) dashboards added to $@"

main.libsonnet: gen.libsonnet