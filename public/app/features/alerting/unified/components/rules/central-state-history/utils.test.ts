import fixtureData from './__fixtures__/alert-state-history';
import { historyResultToDataFrame } from './utils';

describe('historyResultToDataFrame', () => {
  it('should decode', () => {
    expect(historyResultToDataFrame(fixtureData)).toMatchSnapshot();
  });

  it('should decode and filter', () => {
    expect(historyResultToDataFrame(fixtureData, { stateFrom: 'Pending', stateTo: 'Alerting' })).toMatchSnapshot();
  });
});
