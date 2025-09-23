import {
  GrafanaAlertState,
  PromAlertingRuleState,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

describe('Unified Alerting DTO', () => {
  describe('mapStateWithReasonToBaseState', () => {
    it.each`
      arg                               | expected
      ${GrafanaAlertState.Normal}       | ${GrafanaAlertState.Normal}
      ${'Normal (NoData)'}              | ${GrafanaAlertState.Normal}
      ${'Normal (Error)'}               | ${GrafanaAlertState.Normal}
      ${GrafanaAlertState.Alerting}     | ${GrafanaAlertState.Alerting}
      ${'Alerting (NoData)'}            | ${GrafanaAlertState.Alerting}
      ${'Alerting (Error)'}             | ${GrafanaAlertState.Alerting}
      ${'Pending '}                     | ${GrafanaAlertState.Pending}
      ${'NoData'}                       | ${GrafanaAlertState.NoData}
      ${'Error'}                        | ${GrafanaAlertState.Error}
      ${PromAlertingRuleState.Firing}   | ${PromAlertingRuleState.Firing}
      ${PromAlertingRuleState.Pending}  | ${PromAlertingRuleState.Pending}
      ${PromAlertingRuleState.Inactive} | ${PromAlertingRuleState.Inactive}
    `('should map correctly', ({ arg, expected }) => {
      const result = mapStateWithReasonToBaseState(arg);
      expect(result).toEqual(expected);
    });
  });
});
