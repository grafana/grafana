import { jsonDiff } from '../../../settings/version-history/utils';
import { claimCovers, pathKey } from '../types';

import { type ListContext } from './namedLists';
import { describeShowHideRules } from './showHideRules';

const noDefaults: ListContext = { isDefault: () => false };

const variableRule = (variable: string, operator: string, value: string) => ({
  kind: 'ConditionalRenderingVariable',
  spec: { variable, operator, value },
});
const group = (visibility: string, condition: string, items: unknown[]) => ({
  kind: 'ConditionalRenderingGroup',
  spec: { visibility, condition, items },
});

function lines(before: unknown, after: unknown) {
  const wrap = (value: unknown) => ({ row: { spec: value === undefined ? {} : { conditionalRendering: value } } });
  const diffs = Object.values(jsonDiff(wrap(before), wrap(after))).flat();
  const claims = diffs.map((diff) => pathKey(diff.path));
  const changes = describeShowHideRules('row', before, after, claims, diffs, noDefaults);
  for (const claim of claims) {
    expect(changes.filter((change) => change.claims.some((own) => claimCovers(own, claim)))).toHaveLength(1);
  }
  return changes.map(({ text, kind, subject, details, statusText, properties, categoryNote }) => ({
    text,
    kind,
    subject,
    ...(details && { details }),
    ...(statusText && { statusText }),
    ...(properties && { properties }),
    ...(categoryNote && { categoryNote }),
  }));
}

describe('describeShowHideRules', () => {
  it('words visibility and match rules in the editor words', () => {
    const rules = [variableRule('env', 'equals', 'prod')];

    expect(lines(group('show', 'and', rules), group('hide', 'or', rules)).map(({ text }) => text)).toEqual([
      'Row visibility: Show → Hide',
      'Match rules: Match all → Match any',
    ]);
  });

  it('matches rules by variable, not by index', () => {
    const before = group('show', 'and', [
      variableRule('env', 'equals', 'prod'),
      variableRule('region', 'equals', 'eu-west'),
    ]);
    const after = group('show', 'and', [
      variableRule('env', 'matches', 'prod|staging'),
      variableRule('cluster', 'equals', 'blue'),
    ]);

    expect(lines(before, after)).toEqual([
      { text: 'Template variable "env": Equals "prod" → Matches "prod|staging"', kind: 'changed', subject: 'rule' },
      // An added or removed rule says so; how the rules combine is said once, next to the category label
      {
        text: 'Rule removed: Template variable "region" Equals "eu-west"',
        kind: 'removed',
        subject: 'rule',
        categoryNote: '(Match all)',
      },
      {
        text: 'Rule added: Template variable "cluster" Equals "blue"',
        kind: 'added',
        subject: 'rule',
        categoryNote: '(Match all)',
      },
    ]);
  });

  it('shows a time range rule with the editor labels', () => {
    const rule = (value: string) => ({ kind: 'ConditionalRenderingTimeRangeSize', spec: { value } });

    expect(lines(group('hide', 'and', [rule('1h')]), group('hide', 'and', [rule('3h')]))[0].text).toBe(
      'Time range less than: 1 hour → 3 hours'
    );
  });

  it('words a whole rule set added as one line, its settings listed behind it, never JSON', () => {
    const after = group('show', 'and', [{ kind: 'ConditionalRenderingData', spec: { value: true } }]);

    expect(lines(undefined, after)).toEqual([
      {
        text: 'Conditional rendering: added',
        kind: 'added',
        subject: undefined,
        statusText: '(1 rule)',
        properties: [
          { label: 'Row visibility', value: 'Show' },
          { label: 'Match rules', value: 'Match all' },
          { label: 'Query result', value: 'Has data' },
        ],
      },
    ]);
  });
});
