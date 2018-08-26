import { types, getEnv, flow } from 'mobx-state-tree';
import { AlertRule as AlertRuleModel } from './AlertRule';
import { setStateFields } from './helpers';

type AlertRuleType = typeof AlertRuleModel.Type;
export interface AlertRule extends AlertRuleType {}

export const AlertListStore = types
  .model('AlertListStore', {
    rules: types.array(AlertRuleModel),
    stateFilter: types.optional(types.string, 'all'),
    search: types.optional(types.string, ''),
  })
  .views(self => ({
    get filteredRules() {
      const regex = new RegExp(self.search, 'i');
      return self.rules.filter(alert => {
        return regex.test(alert.name) || regex.test(alert.stateText) || regex.test(alert.info);
      });
    },
  }))
  .actions(self => ({
    loadRules: flow(function* load(filters) {
      const backendSrv = getEnv(self).backendSrv;
      self.stateFilter = filters.state; // store state filter used in api query
      const apiRules = yield backendSrv.get('/api/alerts', filters);
      self.rules.clear();

      for (const rule of apiRules) {
        setStateFields(rule, rule.state);

        if (rule.state !== 'paused') {
          if (rule.executionError) {
            rule.info = 'Execution Error: ' + rule.executionError;
          }
          if (rule.evalData && rule.evalData.noData) {
            rule.info = 'Query returned no data';
          }
        }

        self.rules.push(AlertRuleModel.create(rule));
      }
    }),
    setSearchQuery(query: string) {
      self.search = query;
    },
  }));
