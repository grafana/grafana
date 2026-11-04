import { t } from '@grafana/i18n';

import { type Diff } from '../../../settings/version-history/utils';
import { type PathKey, pathKey, type ReviewChange } from '../types';

import { added, describeValue, removed, type Worded } from './formatters';
import { type NamedListItems, describeNamedList, type ListContext } from './namedLists';
import { asArray, isUnset, valueAt } from './paths';

const noEscape = { escapeValue: false };

export type ShowHideOwner = 'row' | 'tab' | 'panel';

/**
 * Words a change of show / hide rules (`conditionalRendering`) in the rules editor's words: one line for the
 * visibility, one for the match rules, and one per rule, rules matched by kind and variable, never by index.
 * `diffs` are the diffs the change claims; each ends up on exactly one line.
 */
export function describeShowHideRules(
  owner: ShowHideOwner,
  before: unknown,
  after: unknown,
  claims: PathKey[],
  diffs: Diff[],
  list: ListContext
): ReviewChange[] {
  const label = t('dashboard-scene.review.field.conditional-rendering', 'Conditional rendering');
  if (isUnset(before) || isUnset(after)) {
    const worded: Worded = isUnset(before)
      ? { ...added(label), details: { after: ruleSetLines(owner, after) } }
      : { ...removed(label), details: { before: ruleSetLines(owner, before) } };
    return [{ ...worded, claims }];
  }

  const base = basePathOf(claims, diffs);
  const lines: Array<ReviewChange & { part?: string }> = [];
  const visibility = (group: unknown) => valueAt(group, ['spec', 'visibility']);
  const condition = (group: unknown) => valueAt(group, ['spec', 'condition']);
  if (visibility(before) !== visibility(after)) {
    lines.push({
      ...describeValue(visibilityLabel(owner, ruleCount(after)), visibility(before), visibility(after), {
        type: 'name',
        display: displayVisibility,
      }),
      claims: [],
      part: 'visibility',
    });
  }
  if (condition(before) !== condition(after)) {
    lines.push({
      ...describeValue(matchRulesLabel(), condition(before), condition(after), {
        type: 'name',
        display: displayCondition,
      }),
      claims: [],
      part: 'condition',
    });
  }

  const itemsPath = base ? [...base, 'spec', 'items'] : undefined;
  const ruleDiffs = itemsPath ? diffs.filter((diff) => startsWith(diff.path, itemsPath)) : [];
  const rules = describeNamedList(
    itemsPath ?? [],
    asArray(valueAt(before, ['spec', 'items'])),
    asArray(valueAt(after, ['spec', 'items'])),
    ruleDiffs,
    ruleItems,
    list
  );
  lines.push(...rules);

  if (!lines.length) {
    return [{ ...describeValue(label, before, after, { type: 'long' }), claims }];
  }
  for (const diff of diffs) {
    if (ruleDiffs.includes(diff)) {
      continue;
    }
    const part = base && diff.path.length > base.length + 1 ? diff.path[base.length + 1] : undefined;
    (lines.find((line) => line.part !== undefined && line.part === part) ?? lines[0]).claims.push(pathKey(diff.path));
  }
  return lines.map(({ part, ...change }) => change);
}

/** Readable lines for a whole rule set, never JSON: visibility, match rules, then one line per rule. */
function ruleSetLines(owner: ShowHideOwner, group: unknown): string {
  const items = asArray(valueAt(group, ['spec', 'items']));
  return [
    lineOf(visibilityLabel(owner, items.length), displayVisibility(valueAt(group, ['spec', 'visibility']))),
    lineOf(matchRulesLabel(), displayCondition(valueAt(group, ['spec', 'condition']))),
    ...items.map((item, index) => lineOf(ruleItems.nameOf(item, index, items), ruleValue(item))),
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function lineOf(label: string, value: string | undefined): string | undefined {
  return value === undefined
    ? undefined
    : t('dashboard-scene.review.value.rule-line', '{{label}}: {{value}}', { label, value, interpolation: noEscape });
}

const ruleItems: NamedListItems = {
  keyOf: (item) => {
    const kind = String(valueAt(item, ['kind']) ?? '');
    return kind === 'ConditionalRenderingVariable' ? `${kind}:${String(valueAt(item, ['spec', 'variable']))}` : kind;
  },
  nameOf: (item) => {
    switch (valueAt(item, ['kind'])) {
      case 'ConditionalRenderingVariable':
        return t('dashboard-scene.review.item.rule-variable', 'Template variable "{{name}}"', {
          name: String(valueAt(item, ['spec', 'variable']) ?? ''),
          interpolation: noEscape,
        });
      case 'ConditionalRenderingData':
        return t('dashboard.conditional-rendering.conditions.data.label', 'Query result');
      case 'ConditionalRenderingTimeRangeSize':
        return t('dashboard-scene.review.item.rule-time-range', 'Time range less than');
      default:
        return t('dashboard-scene.review.item.rule', 'Rule');
    }
  },
  // A rule is one value: "Template variable "env": Equals "prod" → Matches "prod|staging"".
  fieldOf: () => ({ key: 'rule', label: '', format: { type: 'name' }, read: ruleValue }),
  orderLabel: () => t('dashboard-scene.review.item-order.rules', 'Rule order'),
  subjectOf: () => 'rule',
  elementText: (item, index, all) =>
    t('dashboard-scene.review.item.rule-with-value', '{{name}} {{value}}', {
      name: ruleItems.nameOf(item, index, all),
      value: ruleValue(item) ?? '',
      interpolation: noEscape,
    }),
};

function ruleValue(item: unknown): string | undefined {
  const value = valueAt(item, ['spec', 'value']);
  switch (valueAt(item, ['kind'])) {
    case 'ConditionalRenderingVariable':
      return operatorText(valueAt(item, ['spec', 'operator']), String(value ?? ''));
    case 'ConditionalRenderingData':
      return value
        ? t('dashboard.conditional-rendering.conditions.data.enable', 'Has data')
        : t('dashboard.conditional-rendering.conditions.data.disable', 'No data');
    case 'ConditionalRenderingTimeRangeSize':
      return typeof value === 'string' ? (timeRangeLabel(value) ?? value) : undefined;
    default:
      return value === undefined ? undefined : JSON.stringify(value);
  }
}

function operatorText(operator: unknown, value: string): string {
  switch (operator) {
    case 'notEquals':
      return t('dashboard-scene.review.value.rule-not-equals', 'Not equals "{{value}}"', {
        value,
        interpolation: noEscape,
      });
    case 'matches':
      return t('dashboard-scene.review.value.rule-matches', 'Matches "{{value}}"', { value, interpolation: noEscape });
    case 'notMatches':
      return t('dashboard-scene.review.value.rule-not-matches', 'Not matches "{{value}}"', {
        value,
        interpolation: noEscape,
      });
    case 'equals':
    default:
      return t('dashboard-scene.review.value.rule-equals', 'Equals "{{value}}"', { value, interpolation: noEscape });
  }
}

/** The time range rule editor's own labels for its choices. */
function timeRangeLabel(value: string): string | undefined {
  const match = /^(\d+)([mhdMy])$/.exec(value);
  if (!match) {
    return undefined;
  }
  const count = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.minutes', '{{value}} minutes', {
        value: count,
      });
    case 'h':
      return count === 1
        ? t('dashboard.conditional-rendering.conditions.time-range-size.values.hour', '{{value}} hour', {
            value: count,
          })
        : t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
            value: count,
          });
    case 'd':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
        value: count,
      });
    case 'M':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.months', '{{value}} months', {
        value: count,
      });
    case 'y':
      return count === 1
        ? t('dashboard.conditional-rendering.conditions.time-range-size.values.year', '{{value}} year', {
            value: count,
          })
        : t('dashboard.conditional-rendering.conditions.time-range-size.values.years', '{{value}} years', {
            value: count,
          });
    default:
      return undefined;
  }
}

function ruleCount(group: unknown): number {
  return asArray(valueAt(group, ['spec', 'items'])).length;
}

// With several rules, "Panel visibility: Hide" could read as the item being hidden outright, so the label says it
// applies when the rules match; with a single rule the plain editor label is clear enough.
function visibilityLabel(owner: ShowHideOwner, rules: number): string {
  if (rules > 1) {
    switch (owner) {
      case 'tab':
        return t('dashboard-scene.review.field.tab-visibility-when-rules-match', 'Tab visibility when the rules match');
      case 'panel':
        return t(
          'dashboard-scene.review.field.panel-visibility-when-rules-match',
          'Panel visibility when the rules match'
        );
      case 'row':
      default:
        return t('dashboard-scene.review.field.row-visibility-when-rules-match', 'Row visibility when the rules match');
    }
  }
  switch (owner) {
    case 'tab':
      return t('dashboard-scene.review.field.tab-visibility', 'Tab visibility');
    case 'panel':
      return t('dashboard-scene.review.field.panel-visibility', 'Panel visibility');
    case 'row':
    default:
      return t('dashboard-scene.review.field.row-visibility', 'Row visibility');
  }
}

function matchRulesLabel(): string {
  return t('dashboard-scene.review.field.match-rules', 'Match rules');
}

function displayVisibility(value: unknown): string | undefined {
  switch (value) {
    case 'show':
      return t('dashboard.conditional-rendering.conditions.group.visibility.show', 'Show');
    case 'hide':
      return t('dashboard.conditional-rendering.conditions.group.visibility.hide', 'Hide');
    default:
      return typeof value === 'string' ? value : undefined;
  }
}

function displayCondition(value: unknown): string | undefined {
  switch (value) {
    case 'and':
      return t('dashboard.conditional-rendering.conditions.group.condition.all', 'Match all');
    case 'or':
      return t('dashboard.conditional-rendering.conditions.group.condition.any', 'Match any');
    default:
      return typeof value === 'string' ? value : undefined;
  }
}

/** The path of the `conditionalRendering` value the diffs sit under. */
function basePathOf(claims: PathKey[], diffs: Diff[]): string[] | undefined {
  const segments = diffs[0]?.path ?? claims[0]?.split('/');
  const index = segments?.lastIndexOf('conditionalRendering') ?? -1;
  return segments && index >= 0 ? segments.slice(0, index + 1) : undefined;
}

function startsWith(path: string[], prefix: string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment);
}
