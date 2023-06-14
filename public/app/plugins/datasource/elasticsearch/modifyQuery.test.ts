import { queryHasFilter, removeFilterFromQuery, addFilterToQuery } from './modifyQuery';

describe('queryHasFilter', () => {
  it('should return true if the query contains the filter', () => {
    expect(queryHasFilter('label:"value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label: "value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label : "value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label:value', 'label', 'value')).toBe(true);
  });
  it('should return false if the query does not contain the filter', () => {
    const query = 'label:"value"';
    expect(queryHasFilter(query, 'label', 'otherValue')).toBe(false);
  });
});

describe('removeFilterFromQuery', () => {
  it('should remove filter from query', () => {
    const query = 'label:"value"';
    expect(removeFilterFromQuery(query, 'label', 'value')).toBe('');
  });
  it('should remove filter from query with other filters', () => {
    expect(removeFilterFromQuery('label:"value" AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromQuery('label:value AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromQuery('label : "value" OR label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
  });
});

describe('addFilterToQuery', () => {
  it('should add filter to query', () => {
    expect(addFilterToQuery('', 'label', 'value')).toBe('label:"value"');
  });
  it('should add filter to query with other filters', () => {
    expect(addFilterToQuery('label2:"value2"', 'label', 'value')).toBe('label2:"value2" AND label:"value"');
  });
});
