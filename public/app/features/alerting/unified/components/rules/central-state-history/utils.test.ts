import fixtureData from './__fixtures__/alert-state-history';
import { historyResultToDataFrame } from './utils';

describe('historyResultToDataFrame', () => {
  it('should decode', () => {
    expect(historyResultToDataFrame(fixtureData)).toMatchSnapshot();
  });

  it('should decode and filter example1', () => {
    expect(
      historyResultToDataFrame(fixtureData, {
        stateFrom: 'Pending',
        stateTo: 'Alerting',
        labels: "alertname: 'XSS attack vector'",
      })
    ).toMatchSnapshot();
  });
  it('should decode and filter example2', () => {
    expect(
      historyResultToDataFrame(fixtureData, { stateFrom: 'Normal', stateTo: 'NoData', labels: 'region: EMEA' })
    ).toMatchSnapshot();
  });
});
