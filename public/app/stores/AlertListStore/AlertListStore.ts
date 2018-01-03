import { types, getEnv, flow } from 'mobx-state-tree';
import moment from 'moment';
import alertDef from 'app/features/alerting/alert_def';

function setStateFields(rule, state) {
  let stateModel = alertDef.getStateDisplayModel(state);
  rule.state = state;
  rule.stateText = stateModel.text;
  rule.stateIcon = stateModel.iconClass;
  rule.stateClass = stateModel.stateClass;
  rule.stateAge = moment(rule.newStateDate)
    .fromNow()
    .replace(' ago', '');
}

export const AlertRule = types
  .model('AlertRule', {
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
  })
  .views(self => ({
    get isPaused() {
      return self.state === 'paused';
    },
  }))
  .actions(self => ({
    /**
     * will toggle alert rule paused state
     */
    togglePaused: flow(function* togglePaused() {
      let backendSrv = getEnv(self).backendSrv;

      var payload = { paused: self.isPaused };
      let res = yield backendSrv.post(`/api/alerts/${self.id}/pause`, payload);
      setStateFields(self, res.state);
      self.info = '';
    }),
  }));

type IAlertRuleType = typeof AlertRule.Type;
export interface IAlertRule extends IAlertRuleType {}

export const AlertListStore = types
  .model('AlertListStore', {
    rules: types.array(AlertRule),
    stateFilter: types.optional(types.string, 'all'),
  })
  .actions(self => ({
    loadRules: flow(function* load(filters) {
      let backendSrv = getEnv(self).backendSrv;

      // store state filter used in api query
      self.stateFilter = filters.state;

      let apiRules = yield backendSrv.get('/api/alerts', filters);

      self.rules.clear();

      for (let rule of apiRules) {
        setStateFields(rule, rule.state);

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
