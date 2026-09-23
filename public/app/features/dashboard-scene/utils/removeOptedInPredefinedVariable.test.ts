import { namesForPredefinedRemoval } from './removeOptedInPredefinedVariable';

describe('namesForPredefinedRemoval', () => {
  it('keeps the fetched sibling list when the variable is in it', () => {
    expect(namesForPredefinedRemoval(['env', 'region'], 'env', ['env'])).toEqual(['env', 'region']);
  });

  it('uses the names already on the dashboard when the fetch missed the variable', () => {
    expect(namesForPredefinedRemoval([], 'env', ['env', 'region'])).toEqual(['env', 'region']);
  });

  it('includes the variable when neither list has it', () => {
    expect(namesForPredefinedRemoval(['region'], 'env', ['region'])).toEqual(['region', 'env']);
  });
});
