import { getBackendSrv } from 'app/core/services/backend_srv';
import alertDef from './alertDef';
import moment from 'moment';

export interface AlertRule {
  id: number;
  dashboardId: number;
  panelId: number;
  name: string;
  state: string;
  stateText: string;
  stateIcon: string;
  stateClass: string;
  stateAge: string;
  info?: string;
  url: string;
}

export function setStateFields(rule, state) {
  const stateModel = alertDef.getStateDisplayModel(state);
  rule.state = state;
  rule.stateText = stateModel.text;
  rule.stateIcon = stateModel.iconClass;
  rule.stateClass = stateModel.stateClass;
  rule.stateAge = moment(rule.newStateDate)
    .fromNow()
    .replace(' ago', '');
}

export const getAlertRules = async (): Promise<AlertRule[]> => {
  try {
    const rules = await getBackendSrv().get('/api/alerts', {});

    for (const rule of rules) {
      setStateFields(rule, rule.state);

      if (rule.state !== 'paused') {
        if (rule.executionError) {
          rule.info = 'Execution Error: ' + rule.executionError;
        }
        if (rule.evalData && rule.evalData.noData) {
          rule.info = 'Query returned no data';
        }
      }
    }

    return rules;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
