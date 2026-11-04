import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import { pathKey, type ReviewChange } from '../types';

import { describeLong, describeValue, displayTimeRange, fromTo, type ValueFormat } from './formatters';
import { humanizePath, joinLabel } from './labels';
import { type ListKindContext, listItemsOf } from './listKinds';
import { describeNamedList, type ListContext } from './namedLists';
import { asArray, valueAt } from './paths';
import { displayGridKind, type FieldTarget, labels } from './rules';

const noEscape = { escapeValue: false };

export interface DescribeContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  list: ListContext;
  listKind(target: FieldTarget): ListKindContext;
}

/** Words the diffs of one field (or one named list) as review changes, each claiming the diffs it accounts for. */
export function describeField(target: FieldTarget, diffs: Diff[], ctx: DescribeContext): ReviewChange[] {
  const claims = diffs.map((diff) => pathKey(diff.path));
  const { describe } = target;
  switch (describe.type) {
    case 'timeRange': {
      const range = (spec: DashboardV2Spec) => displayTimeRange(spec.timeSettings?.from, spec.timeSettings?.to);
      return [{ kind: 'changed', text: fromTo(labels.timeRange(), range(ctx.baseline), range(ctx.payload)), claims }];
    }
    case 'namedList': {
      const before = asArray(valueAt(ctx.baseline, target.path));
      const after = asArray(valueAt(ctx.payload, target.path));
      const items = listItemsOf(describe.list, ctx.listKind(target));
      return describeNamedList(target.path, before, after, diffs, items, ctx.list);
    }
    case 'defaultGrid': {
      const kindPath = ['preferences', 'layout', 'kind'];
      const before = valueAt(ctx.baseline, kindPath);
      const after = valueAt(ctx.payload, kindPath);
      if (before !== after) {
        const worded = describeValue(labels.defaultGrid(), before, after, { type: 'name', display: displayGridKind });
        return [{ ...worded, claims }];
      }
      const layout = ['preferences', 'layout'];
      return [
        { ...describeLong(labels.defaultGrid(), valueAt(ctx.baseline, layout), valueAt(ctx.payload, layout)), claims },
      ];
    }
    case 'libraryConversion': {
      const name = (spec: DashboardV2Spec) =>
        valueAt(spec, ['elements', describe.element, 'spec', 'libraryPanel', 'name']);
      const toLibrary = valueAt(ctx.payload, ['elements', describe.element, 'kind']) === 'LibraryPanel';
      const text = toLibrary
        ? t('dashboard-scene.review.change.library-converted', 'Converted to library panel "{{name}}"', {
            name: String(name(ctx.payload) ?? ''),
            interpolation: noEscape,
          })
        : t('dashboard-scene.review.change.library-unlinked', 'Unlinked from library panel "{{name}}"', {
            name: String(name(ctx.baseline) ?? ''),
            interpolation: noEscape,
          });
      return [{ kind: 'changed', text, claims }];
    }
    case 'value':
    default: {
      const read = describe.read ?? ((spec: DashboardV2Spec) => valueAt(spec, target.path));
      const before = read(ctx.baseline);
      const after = read(ctx.payload);
      if (describe.read && isEqual(before, after)) {
        // What `read` shows didn't change (e.g. a library panel's uid): show the whole value instead.
        const whole = describeLong(
          describe.label,
          valueAt(ctx.baseline, target.path),
          valueAt(ctx.payload, target.path)
        );
        return [{ ...whole, claims }];
      }
      return [{ ...describeValue(describe.label, before, after, describe.format), claims }];
    }
  }
}

/** Words a system default the payload fills in (WORDING.md §10), with the same phrasing as any other change. */
export function describeDefaultDiff(target: FieldTarget, diff: Diff, ctx: DescribeContext): ReviewChange {
  const { label, format } = defaultField(target, diff, ctx);
  const before = valueAt(ctx.baseline, diff.path);
  return { ...describeValue(label, before, valueAt(ctx.payload, diff.path), format), claims: [pathKey(diff.path)] };
}

function defaultField(target: FieldTarget, diff: Diff, ctx: DescribeContext): { label: string; format: ValueFormat } {
  const { describe } = target;
  const below = diff.path.slice(target.path.length);
  const auto: ValueFormat = { type: 'auto' };
  switch (describe.type) {
    case 'value':
      return { label: describe.label, format: below.length ? auto : describe.format };
    case 'namedList': {
      const items = listItemsOf(describe.list, ctx.listKind(target));
      const after = asArray(valueAt(ctx.payload, target.path));
      const index = Number(below[0]);
      if (!Number.isInteger(index) || after[index] === undefined) {
        return { label: humanizePath(target.path.slice(-1)), format: auto };
      }
      const name = items.nameOf(after[index], index, after);
      const inner = below.slice(1);
      const field = inner.length ? items.fieldOf(inner, undefined, after[index]) : undefined;
      return field ? { label: joinLabel([name, field.label]), format: field.format } : { label: name, format: auto };
    }
    case 'timeRange':
      return { label: labels.timeRange(), format: auto };
    case 'defaultGrid':
      return { label: labels.defaultGrid(), format: auto };
    default:
      return { label: humanizePath(diff.path), format: auto };
  }
}
