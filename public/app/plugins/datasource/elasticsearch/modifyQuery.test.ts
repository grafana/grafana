import { queryHasFilter, removeFilterFromQuery, addFilterToQuery } from './modifyQuery';

describe('queryHasFilter', () => {
  it('should return true if the query contains the positive filter', () => {
    expect(queryHasFilter('label:"value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label: "value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label : "value"', 'label', 'value')).toBe(true);
    expect(queryHasFilter('label:value', 'label', 'value')).toBe(true);
    expect(queryHasFilter('this:"that" AND label:value', 'label', 'value')).toBe(true);
    expect(
      queryHasFilter(
        'message:"Jun 20 17:19:47 Xtorm syslogd[348]: ASL Sender Statistics"',
        'message',
        'Jun 20 17:19:47 Xtorm syslogd[348]: ASL Sender Statistics'
      )
    ).toBe(true);
  });
  it('should return false if the query does not contain the positive filter', () => {
    expect(queryHasFilter('label:"value"', 'label', 'otherValue')).toBe(false);
    expect(queryHasFilter('-label:"value"', 'label', 'value')).toBe(false);
  });
  it('should return true if the query contains the negative filter', () => {
    expect(queryHasFilter('-label:"value"', 'label', 'value', '-')).toBe(true);
    expect(queryHasFilter('-label: "value"', 'label', 'value', '-')).toBe(true);
    expect(queryHasFilter('-label : "value"', 'label', 'value', '-')).toBe(true);
    expect(queryHasFilter('-label:value', 'label', 'value', '-')).toBe(true);
    expect(queryHasFilter('this:"that" AND -label:value', 'label', 'value', '-')).toBe(true);
  });
  it('should return false if the query does not contain the negative filter', () => {
    expect(queryHasFilter('label:"value"', 'label', 'otherValue', '-')).toBe(false);
    expect(queryHasFilter('label:"value"', 'label', 'value', '-')).toBe(false);
  });
  it('should support filters containing colons', () => {
    expect(queryHasFilter('label\\:name:"value"', 'label:name', 'value')).toBe(true);
    expect(queryHasFilter('-label\\:name:"value"', 'label:name', 'value', '-')).toBe(true);
  });
});

describe('addFilterToQuery', () => {
  it('should add a positive filter to the query', () => {
    expect(addFilterToQuery('', 'label', 'value')).toBe('label:"value"');
  });
  it('should add a positive filter to the query with other filters', () => {
    expect(addFilterToQuery('label2:"value2"', 'label', 'value')).toBe('label2:"value2" AND label:"value"');
  });
  it('should add a negative filter to the query', () => {
    expect(addFilterToQuery('', 'label', 'value', '-')).toBe('-label:"value"');
  });
  it('should add a negative filter to the query with other filters', () => {
    expect(addFilterToQuery('label2:"value2"', 'label', 'value', '-')).toBe('label2:"value2" AND -label:"value"');
  });
  it('should support filters with colons', () => {
    expect(addFilterToQuery('', 'label:name', 'value')).toBe('label\\:name:"value"');
  });
});

describe('removeFilterFromQuery', () => {
  it('should remove filter from query', () => {
    expect(removeFilterFromQuery('label:"value"', 'label', 'value')).toBe('');
  });
  it('should remove filter from query with other filters', () => {
    expect(removeFilterFromQuery('label:"value" AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromQuery('label:value AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromQuery('label : "value" OR label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromQuery('test="test" OR label:"value" AND label2:"value2"', 'label', 'value')).toBe(
      'test="test" AND label2:"value2"'
    );
  });
  it('should not remove the wrong filter', () => {
    expect(removeFilterFromQuery('-label:"value" AND label2:"value2"', 'label', 'value')).toBe(
      '-label:"value" AND label2:"value2"'
    );
    expect(removeFilterFromQuery('label2:"value2" OR -label:value', 'label', 'value')).toBe(
      'label2:"value2" OR -label:value'
    );
    expect(removeFilterFromQuery('-label : "value" OR label2:"value2"', 'label', 'value')).toBe(
      '-label : "value" OR label2:"value2"'
    );
  });
  it('should support filters with colons', () => {
    expect(removeFilterFromQuery('label\\:name:"value"', 'label:name', 'value')).toBe('');
  });
});
