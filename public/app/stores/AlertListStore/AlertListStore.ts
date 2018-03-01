import { types, getEnv, flow } from 'mobx-state-tree';
import { AlertRule } from './AlertRule';
import { setStateFields } from './helpers';

type IAlertRuleType = typeof AlertRule.Type;
export interface IAlertRule extends IAlertRuleType {}

export const AlertListStore = types
  .model('AlertListStore', {
    rules: types.array(AlertRule),
    stateFilter: types.optional(types.string, 'all'),
    search: types.optional(types.string, ''),
  })
  .views(self => ({
    get filteredRules() {
      let regex = new RegExp(self.search, 'i');
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

      for (let rule of apiRules) {
        setStateFields(rule, rule.state);

        if (rule.state !== 'paused') {
          if (rule.executionError) {
            rule.info = 'Execution Error: ' + rule.executionError;
          }
          if (rule.evalData && rule.evalData.noData) {
            rule.info = 'Query returned no data';
          }
        }

        self.rules.push(AlertRule.create(rule));
      }
    }),
    setSearchQuery(query: string) {
      self.search = query;
    },
  }));
