import { type RuleKind } from '../shared/ruleKind';

import { alertTokens } from './alertTokens';
import { getIssueHints } from './filterIssueHints';
import { getFilterIssues } from './filterIssues';
import { parse } from './parser';
import { recordingTokens } from './recordingTokens';

function hintsFor(query: string, kind: RuleKind = 'alert') {
  const tokens = kind === 'alert' ? alertTokens : recordingTokens;
  return getIssueHints(getFilterIssues(parse(query, tokens), kind), tokens);
}

describe('getIssueHints', () => {
  it.each([
    ['state:error', 'state:error is not a valid filter. Use health:error.'],
    ['state:nodata', 'state:nodata is not a valid filter. Use health:nodata.'],
    ['is:paused', 'is:paused is not a valid filter. Use paused:true.'],
  ])('points %s at the filter that does what was meant', (query, hint) => {
    expect(hintsFor(query)).toEqual([hint]);
  });

  it('lists the valid keys of the page for an unknown key', () => {
    expect(hintsFor('foo:bar', 'recording')).toEqual([
      'Unknown filter foo. Valid filters: rule, label, namespace, datasource, plugins, metric, targetDatasource, health.',
    ]);
  });

  it('does not suggest an Alert-only filter on the Recording page', () => {
    expect(hintsFor('is:paused', 'recording')).toEqual([
      expect.stringContaining('Unknown filter is. Valid filters: rule, label,'),
    ]);
  });

  it.each([
    ['state:bogus', 'state accepts: firing, pending, recovering, normal.'],
    ['health:bogus', 'health accepts: ok, nodata, error, unknown.'],
    ['paused:maybe', 'paused accepts: true, false.'],
    ['plugins:show', 'plugins accepts: hide.'],
    ['state:', 'state accepts: firing, pending, recovering, normal.'],
  ])('lists the valid values for %s', (query, hint) => {
    expect(hintsFor(query)).toEqual([hint]);
  });

  it('gives no value hint for a repeated key whose value is valid', () => {
    expect(hintsFor('state:firing state:normal')).toEqual([]);
  });

  it('gives one hint per distinct problem', () => {
    expect(hintsFor('foo:a foo:b state:error')).toEqual([
      expect.stringContaining('Unknown filter foo.'),
      'state:error is not a valid filter. Use health:error.',
    ]);
  });
});
