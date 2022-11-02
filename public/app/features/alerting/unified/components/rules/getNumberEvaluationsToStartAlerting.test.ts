import { getNumberEvaluationsToStartAlerting } from './EditRuleGroupModal';
describe('getNumberEvaluationsToStartAlerting method', () => {
  it('should return 0 in case of invalid data', () => {
    expect(getNumberEvaluationsToStartAlerting('sd', 'ksdh')).toBe(0);
  });
  it('should return correct number in case of valid data', () => {
    expect(getNumberEvaluationsToStartAlerting('1m', '10m')).toBe(0);
    expect(getNumberEvaluationsToStartAlerting('10m', '10m')).toBe(2);
    expect(getNumberEvaluationsToStartAlerting('18m', '10m')).toBe(3);
    expect(getNumberEvaluationsToStartAlerting('1h41m', '10m')).toBe(12);
    expect(getNumberEvaluationsToStartAlerting('101m', '10m')).toBe(12);
  });
});
