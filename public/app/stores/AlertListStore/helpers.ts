import moment from 'moment';
import alertDef from 'app/features/alerting/alert_def';

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
