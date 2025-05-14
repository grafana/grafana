import fixtureData from './__fixtures__/alert-state-history';
import { ruleHistoryToRecords } from './useRuleHistoryRecords';

describe('ruleHistoryToRecords', () => {
  it('should convert rule history JSON response to log records', () => {
    expect(ruleHistoryToRecords(fixtureData)).toMatchSnapshot();
  });

  it('should convert rule history JSON response with filters', () => {
    expect(
      ruleHistoryToRecords(fixtureData, { stateFrom: 'Pending', stateTo: 'Alerting', labels: '' })
    ).toMatchSnapshot();
  });

  it('should be empty with no matches', () => {
    expect(
      ruleHistoryToRecords(fixtureData, { stateFrom: 'Pending', stateTo: 'Alerting', labels: 'doesNot=exist' })
    ).toMatchSnapshot();
  });
});
