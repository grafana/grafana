import { compare } from 'fast-json-patch';
import { isEqual } from 'lodash';

import { type Diff } from '../../../settings/version-history/utils';
import { type PathKey, pathKey, type ReviewElementKind } from '../types';

import { changed, describeValue, type ValueFormat, type Worded } from './formatters';
import { joinLabel } from './labels';
import { hasValueAt, isUnset, valueAt } from './paths';

/** A field of a list item: changes inside it are worded as one line. */
export interface ItemField {
  /** Identifies the field within its item. */
  key: string;
  label: string;
  format: ValueFormat;
  read: (item: unknown) => unknown;
}

/** How the items of one list are identified, named and split into fields (WORDING.md §8). */
export interface NamedListItems {
  /** A stable identity (ref ID, name, title, matcher). Duplicates are told apart by occurrence. */
  keyOf(item: unknown): string;
  /** "Query A", "Variable 'env'". `all` is the item's own side, for names that depend on siblings. */
  nameOf(item: unknown, index: number, all: unknown[]): string;
  /** The field a path inside an item belongs to (escaped segments, relative to the item). */
  fieldOf(path: string[], before: unknown, after: unknown): ItemField | undefined;
  /** The fields to compare, when they can't be derived from the paths that differ. */
  fieldsOf?(before: unknown, after: unknown): ItemField[];
  /** "Query order", for "Query order: changed". */
  orderLabel(): string;
  /** The kind of element an item is; every line about the list carries it. */
  subjectOf(item: unknown): ReviewElementKind;
  /** What an added or removed item reads as, when more than its name (a show / hide rule with its value). */
  elementText?(item: unknown, index: number, all: unknown[]): string;
  /** The whole configuration of an added or removed item, revealed on demand. */
  detailsOf?(item: unknown): string | undefined;
}

export interface ListContext {
  /** Whether an `add` at `path` (absolute) is a system default, given what the baseline has. */
  isDefault(path: string[], value: unknown, baselineHas: (path: string[]) => boolean): boolean;
}

interface Slot {
  worded: Worded;
  claims: PathKey[];
  /** Field key for field changes of a matched item. */
  field?: string;
  /** Sort position in the payload's order; removed items sit after their baseline predecessor. */
  position: number;
}

/**
 * Item-level changes of a list whose items have an identity of their own. jsonDiff compares arrays by index,
 * so an insertion or removal shows up as field changes on every shifted item; each such path is claimed once,
 * by the structural change (removal, addition or reorder) that caused it, and unchanged items show nothing.
 *
 * `listPath` is the escaped path of the array; `diffs` are the non-default diffs at or below it.
 */
export function describeNamedList(
  listPath: string[],
  before: unknown[],
  after: unknown[],
  diffs: Diff[],
  items: NamedListItems,
  ctx: ListContext
): Array<Worded & { claims: PathKey[] }> {
  const beforeKeys = withOccurrence(before.map((item) => items.keyOf(item)));
  const afterKeys = withOccurrence(after.map((item) => items.keyOf(item)));
  const beforeIndexByKey = new Map(beforeKeys.map((key, index) => [key, index]));
  const afterIndexByKey = new Map(afterKeys.map((key, index) => [key, index]));
  const matchedBefore: Array<number | undefined> = afterKeys.map((key) => beforeIndexByKey.get(key));

  const addedSlots = new Map<number, Slot>();
  const fieldSlots = new Map<number, Slot[]>();
  const removedSlots = new Map<number, Slot>();

  after.forEach((item, index) => {
    const beforeIndex = matchedBefore[index];
    const name = items.nameOf(item, index, after);
    if (beforeIndex === undefined) {
      const text = items.elementText?.(item, index, after) ?? name;
      const config = items.detailsOf?.(item);
      addedSlots.set(index, {
        worded: {
          kind: 'added',
          text,
          subject: items.subjectOf(item),
          ...(config !== undefined && { details: { after: config } }),
        },
        claims: [],
        position: index,
      });
      return;
    }
    const beforeItem = before[beforeIndex];
    const isDefault = (path: string[], value: unknown) =>
      ctx.isDefault([...listPath, String(index), ...path], value, (absolute) =>
        hasValueAt(beforeItem, absolute.slice(listPath.length + 1))
      );
    const slots = changedFields(beforeItem, item, items, isDefault).map((field, order) => ({
      worded: {
        ...describeValue(joinLabel([name, field.label]), field.read(beforeItem), field.read(item), field.format),
        subject: items.subjectOf(item),
      },
      claims: [],
      field: field.key,
      position: index + order / 1e3,
    }));
    if (slots.length) {
      fieldSlots.set(index, slots);
    }
  });

  before.forEach((item, index) => {
    if (afterIndexByKey.has(beforeKeys[index])) {
      return;
    }
    const config = items.detailsOf?.(item);
    removedSlots.set(index, {
      worded: {
        kind: 'removed',
        text: items.elementText?.(item, index, before) ?? items.nameOf(item, index, before),
        subject: items.subjectOf(item),
        ...(config !== undefined && { details: { before: config } }),
      },
      claims: [],
      position: positionOfRemoved(index, beforeKeys, afterIndexByKey),
    });
  });

  const kept = matchedBefore.filter((index): index is number => index !== undefined);
  const reorder: Slot | undefined = kept.some((index, position) => position > 0 && index < kept[position - 1])
    ? {
        worded: {
          ...changed(items.orderLabel()),
          subject: items.subjectOf(after[0]),
          details: {
            before: [...kept]
              .sort((a, b) => a - b)
              .map((index) => items.nameOf(before[index], index, before))
              .join('\n'),
            after: matchedBefore
              .map((index, afterIndex) =>
                index === undefined ? undefined : items.nameOf(after[afterIndex], afterIndex, after)
              )
              .filter((name) => name !== undefined)
              .join('\n'),
          },
        },
        claims: [],
        position: Number.MAX_SAFE_INTEGER,
      }
    : undefined;

  const structural = [...removedSlots.values(), ...addedSlots.values(), ...(reorder ? [reorder] : [])];
  const extra: Slot[] = [];
  const firstChange = (): Slot => {
    const slot = structural[0] ?? [...fieldSlots.values()][0]?.[0] ?? extra[0];
    if (slot) {
      return slot;
    }
    const created: Slot = {
      worded: { ...changed(items.orderLabel()), subject: items.subjectOf(after[0] ?? before[0]) },
      claims: [],
      position: Number.MAX_SAFE_INTEGER,
    };
    extra.push(created);
    return created;
  };

  for (const diff of diffs) {
    const key = pathKey(diff.path);
    const index = diff.path.length > listPath.length ? Number(diff.path[listPath.length]) : NaN;
    if (!Number.isInteger(index)) {
      firstChange().claims.push(key);
      continue;
    }
    const target =
      addedSlots.get(index) ??
      (matchedBefore[index] === index ? fieldSlotFor(diff, index) : undefined) ??
      (index >= after.length || matchedBefore[index] !== index ? removedSlots.get(index) : undefined);
    if (target) {
      target.claims.push(key);
    } else if (matchedBefore[index] === index) {
      // A difference no field accounts for: show it rather than drop it.
      const slot: Slot = {
        worded: { ...changed(items.nameOf(after[index], index, after)), subject: items.subjectOf(after[index]) },
        claims: [key],
        position: index + 0.999,
      };
      fieldSlots.set(index, [...(fieldSlots.get(index) ?? []), slot]);
    } else {
      firstChange().claims.push(key);
    }
  }

  function fieldSlotFor(diff: Diff, index: number): Slot | undefined {
    const slots = fieldSlots.get(index);
    if (!slots?.length) {
      return undefined;
    }
    const relative = diff.path.slice(listPath.length + 1);
    const field = relative.length ? items.fieldOf(relative, before[index], after[index]) : undefined;
    return slots.find((slot) => slot.field === field?.key) ?? slots[0];
  }

  return [
    ...addedSlots.values(),
    ...[...fieldSlots.values()].flat(),
    ...removedSlots.values(),
    ...(reorder ? [reorder] : []),
    ...extra,
  ]
    .sort((a, b) => a.position - b.position)
    .map((slot) => ({ ...slot.worded, claims: slot.claims }));
}

/** The fields of a matched pair that differ, leaving out differences that are only system defaults. */
function changedFields(
  before: unknown,
  after: unknown,
  items: NamedListItems,
  isDefault: (path: string[], value: unknown) => boolean
): ItemField[] {
  if (items.fieldsOf) {
    return items.fieldsOf(before, after).filter((field) => !isEqual(field.read(before), field.read(after)));
  }
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) {
    return [];
  }
  const fields: ItemField[] = [];
  for (const op of compare(before, after)) {
    const path = op.path.split('/').slice(1);
    if (op.op === 'add' && isDefault(path, op.value)) {
      continue;
    }
    if (isUnset(valueAt(before, path)) && isUnset(valueAt(after, path))) {
      continue;
    }
    const field = items.fieldOf(path, before, after);
    if (field && !fields.some((known) => known.key === field.key) && !isEqual(field.read(before), field.read(after))) {
      fields.push(field);
    }
  }
  return fields;
}

function withOccurrence(keys: string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return `${key}#${count}`;
  });
}

/** A removed item sits right after the last baseline item before it that is still there. */
function positionOfRemoved(index: number, beforeKeys: string[], afterIndexByKey: Map<string, number>): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const afterIndex = afterIndexByKey.get(beforeKeys[previous]);
    if (afterIndex !== undefined) {
      return afterIndex + 0.9 + index / 1e6;
    }
  }
  return -1 + index / 1e6;
}
