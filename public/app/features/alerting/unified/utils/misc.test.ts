import { sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

function withState(state: GrafanaAlertState, labels?: {}): Alert {
  return { activeAt: '', annotations: {}, labels: labels || {}, state: state, value: '' };
}

function withDate(activeAt?: string, labels?: {}): Alert {
  return {
    activeAt: activeAt || '',
    annotations: {},
    labels: labels || {},
    state: GrafanaAlertState.Alerting,
    value: '',
  };
}

function permute(inputArray: any[]): any[] {
  return inputArray.reduce(function permute(res, item, key, arr) {
    return res.concat(
      (arr.length > 1 &&
        arr
          .slice(0, key)
          .concat(arr.slice(key + 1))
          .reduce(permute, [])
          .map(function (perm: any) {
            return [item].concat(perm);
          })) ||
        item
    );
  }, []);
}

describe('Unified Altering misc', () => {
  describe('sortAlerts', () => {
    describe('when using any sortOrder with a list of alert instances', () => {
      it.each`
        alerts                                                                                                                   | sortOrder               | expected
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Normal)]}    | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Normal)]}
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.NoData)]}    | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.NoData)]}
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Error), withState(GrafanaAlertState.Normal)]}       | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Error), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Normal)]}
        ${[withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]} | ${SortOrder.TimeAsc}    | ${[withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00')]}
        ${[withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]} | ${SortOrder.TimeDesc}   | ${[withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]}
        ${[withDate('', { mno: 'pqr' }), withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' })]}                            | ${SortOrder.AlphaAsc}   | ${[withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' }), withDate('', { mno: 'pqr' })]}
        ${[withDate('', { mno: 'pqr' }), withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' })]}                            | ${SortOrder.AlphaDesc}  | ${[withDate('', { mno: 'pqr' }), withDate('', { ghi: 'jkl' }), withDate('', { abc: 'def' })]}
      `('then it should sort the alerts correctly', ({ alerts, sortOrder, expected }) => {
        const result = sortAlerts(sortOrder, alerts);

        expect(result).toEqual(expected);
      });
    });

    describe('when sorting ties', () => {
      it.each`
        alerts                                                                                                                                                   | sortOrder
        ${[withState(GrafanaAlertState.Alerting, { ghi: 'jkl' }), withState(GrafanaAlertState.Alerting, { abc: 'def' }), withState(GrafanaAlertState.Alerting)]} | ${SortOrder.Importance}
        ${[withDate('2021-11-29T13:10:07-05:00', { ghi: 'jkl' }), withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00', { abc: 'def' })]} | ${SortOrder.TimeAsc}
        ${[withDate('2021-11-29T13:10:07-05:00', { ghi: 'jkl' }), withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00', { abc: 'def' })]} | ${SortOrder.TimeDesc}
      `('then tie order should be deterministic', ({ alerts, sortOrder }) => {
        // All input permutations should result in the same sorted order
        const sortedPermutations = permute(alerts).map((a) => sortAlerts(sortOrder, a));
        sortedPermutations.forEach((p) => {
          expect(p).toEqual(sortedPermutations[0]);
        });
      });
    });
  });
});
