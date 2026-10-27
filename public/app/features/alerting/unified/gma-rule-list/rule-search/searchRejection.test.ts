import { buildAlertRuleLeaves } from '../alert-rules/alertRuleSearchQuery';

import { parse } from './parser';
import { getRejectionIssues } from './searchRejection';

function rejectionOf(query: string, causes: Array<{ field?: string; message: string }>) {
  const error = { status: 422, data: { message: 'invalid', details: { causes } } };
  return getRejectionIssues(error, buildAlertRuleLeaves(parse(query, 'alert').filter));
}

describe('getRejectionIssues', () => {
  it('names the filter of the only leaf', () => {
    expect(rejectionOf('label:team=~(', [{ field: 'where.regex.pattern', message: 'missing )' }])).toEqual([
      { key: 'label', reason: 'rejected', message: 'missing )' },
    ]);
  });

  it('names the filter of each rejected leaf of an and', () => {
    const causes = [
      { field: 'where.and[1].regex.pattern', message: 'missing )' },
      { field: 'where.and[2].filter.values', message: 'bad uid' },
    ];
    expect(rejectionOf('cpu label:team=~( panelId:4 dashboard:d', causes)).toEqual([
      { key: 'label', reason: 'rejected', message: 'missing )' },
      { key: 'dashboard', reason: 'rejected', message: 'bad uid' },
    ]);
  });

  it('names no filter for a cause outside the where clause', () => {
    expect(rejectionOf('cpu', [{ field: 'limit', message: 'too big' }])).toEqual([
      { key: null, reason: 'rejected', message: 'too big' },
    ]);
  });

  it('uses the status message when the refusal has no causes', () => {
    const error = { status: 422, data: { message: 'invalid query' } };
    expect(getRejectionIssues(error, [])).toEqual([{ key: null, reason: 'rejected', message: 'invalid query' }]);
  });

  it('leaves any other failure to the list', () => {
    expect(getRejectionIssues({ status: 500, data: { message: 'boom' } }, [])).toBeUndefined();
  });
});
