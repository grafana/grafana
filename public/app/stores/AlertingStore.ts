import { types, getEnv, flow } from 'mobx-state-tree';
import moment from 'moment';
import alertDef from 'app/features/alerting/alert_def';

export const AlertRule = types.model('AlertRule', {
  id: types.identifier(types.number),
  dashboardId: types.number,
  panelId: types.number,
  name: types.string,
  state: types.string,
  stateText: types.string,
  stateIcon: types.string,
  stateClass: types.string,
  stateAge: types.string,
  info: types.optional(types.string, ''),
  dashboardUri: types.string,
});

export const AlertingStore = types
  .model('AlertingStore', {
    rules: types.array(AlertRule),
  })
  .actions(self => ({
    loadRules: flow(function* load() {
      let backendSrv = getEnv(self).backendSrv;

      let rules = yield backendSrv.get('/api/alerts');

      self.rules.clear();

      for (let rule of rules) {
        let stateModel = alertDef.getStateDisplayModel(rule.state);
        rule.stateText = stateModel.text;
        rule.stateIcon = stateModel.iconClass;
        rule.stateClass = stateModel.stateClass;
        rule.stateAge = moment(rule.newStateDate)
          .fromNow()
          .replace(' ago', '');

        if (rule.executionError) {
          rule.info = 'Execution Error: ' + rule.executionError;
        }

        if (rule.evalData && rule.evalData.noData) {
          rule.info = 'Query returned no data';
        }

        self.rules.push(AlertRule.create(rule));
      }
    }),
  }));
