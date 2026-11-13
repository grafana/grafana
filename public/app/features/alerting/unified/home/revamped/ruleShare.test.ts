import { percentOfRules } from './ruleShare';

describe('percentOfRules', () => {
  it('is the count as a whole-number percentage of active plus paused rules', () => {
    expect(percentOfRules(79, 79, 21)).toBe(79);
    expect(percentOfRules(21, 79, 21)).toBe(21);
  });

  it('rounds to the nearest whole number', () => {
    // 2 of 3 is 66.67%, 1 of 3 is 33.33%.
    expect(percentOfRules(2, 2, 1)).toBe(67);
    expect(percentOfRules(1, 2, 1)).toBe(33);
  });

  it('is undefined when there are no rules, so nothing divides by zero', () => {
    expect(percentOfRules(0, 0, 0)).toBeUndefined();
  });

  it('is 0 or 100 when every rule is on one side', () => {
    expect(percentOfRules(0, 5, 0)).toBe(0);
    expect(percentOfRules(5, 5, 0)).toBe(100);
  });
});
