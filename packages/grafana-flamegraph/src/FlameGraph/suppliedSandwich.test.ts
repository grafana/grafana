import { createDataFrame, FieldType } from '@grafana/data';

import { prepareSuppliedSandwich, type SandwichNode, type SuppliedSandwich } from './suppliedSandwich';

const node = (name: string, total: number, self = 0, children?: SandwichNode[]): SandwichNode => ({
  name,
  total,
  self,
  children,
});

/** Callers rooted at f: f <- a <- root, and f <- b <- root. */
const callers = node('f', 15, 0, [
  node('a', 8, 0, [node('root', 8)]),
  node('b', 7, 0, [node('root', 7)]),
]);

const callees = node('f', 15, 0, [node('x', 10, 10), node('y', 5, 5)]);

const sandwich: SuppliedSandwich = { label: 'f', total: 15, self: 0, callers, callees };

const unitField = createDataFrame({
  fields: [{ name: 'value', values: [1], type: FieldType.number, config: { unit: 'ns' } }],
}).fields[0];

const labelsOf = (levels: Array<Array<{ itemIndexes: number[] }>>, data: { getLabel: (i: number) => string }) =>
  levels.map((level) => level.map((item) => data.getLabel(item.itemIndexes[0])));

describe('prepareSuppliedSandwich', () => {
  it('builds both halves with the callers growing outwards', () => {
    const result = prepareSuppliedSandwich(sandwich, 'f', unitField);
    expect(result).toBeDefined();

    // The callee half reads downwards from the function.
    expect(labelsOf(result!.callees!.levels, result!.callees!.data)).toEqual([['f'], ['x', 'y']]);

    // The caller half is reversed, so the canvas can render it with the function at the root and
    // callers growing towards main.
    const callerLabels = labelsOf(result!.callers!.levels, result!.callers!.data);
    expect(callerLabels[callerLabels.length - 1]).toEqual(['f']);
    expect(callerLabels).toEqual([['root', 'root'], ['a', 'b'], ['f']]);
  });

  it('keeps the supplied values', () => {
    const result = prepareSuppliedSandwich(sandwich, 'f', unitField);
    const callees = result!.callees!.levels;
    expect(callees[0][0].value).toBe(15);
    expect(callees[1].map((i) => i.value)).toEqual([10, 5]);

    const callers = result!.callers!.levels;
    // Reversed, so the function is last and its immediate callers are the level before it.
    expect(callers[callers.length - 1][0].value).toBe(15);
    expect(callers[callers.length - 2].map((i) => i.value)).toEqual([8, 7]);
  });

  it('carries the unit of the displayed profile into both halves', () => {
    // A supplied half builds its own frame, so without this the panes would label nanoseconds as
    // a bare count.
    const result = prepareSuppliedSandwich(sandwich, 'f', unitField);
    expect(result!.callees!.data.getUnitTitle()).toBe('Time');
    expect(result!.callers!.data.getUnitTitle()).toBe('Time');

    const withoutUnit = prepareSuppliedSandwich(sandwich, 'f', undefined);
    expect(withoutUnit!.callees!.data.getUnitTitle()).toBe('Count');
  });

  it('reports truncation from either half', () => {
    const truncatedCallees = node('f', 15, 0, [
      node('x', 10, 10),
      { ...node('other', 5, 5), truncated: true },
    ]);
    const result = prepareSuppliedSandwich({ ...sandwich, callees: truncatedCallees }, 'f', unitField);
    expect(result!.truncated).toBe(true);
    expect(prepareSuppliedSandwich(sandwich, 'f', unitField)!.truncated).toBe(false);
  });

  it('ignores a sandwich built for another function', () => {
    // Otherwise one function's callers would render under another's name while a request is in
    // flight, which is worse than falling back to the tree.
    expect(prepareSuppliedSandwich(sandwich, 'other-function', unitField)).toBeUndefined();
  });

  it('ignores a sandwich when nothing is sandwiched', () => {
    expect(prepareSuppliedSandwich(sandwich, undefined, unitField)).toBeUndefined();
    expect(prepareSuppliedSandwich(undefined, 'f', unitField)).toBeUndefined();
  });

  it('ignores a function the profile never saw', () => {
    // The backend names the root after the requested function either way, so an empty report
    // arrives as a zero valued root rather than an absent one.
    const empty: SuppliedSandwich = {
      label: 'missing',
      total: 0,
      self: 0,
      callers: node('missing', 0),
      callees: node('missing', 0),
    };
    expect(prepareSuppliedSandwich(empty, 'missing', unitField)).toBeUndefined();
  });

  it('accepts a half that is present without the other', () => {
    const onlyCallers = prepareSuppliedSandwich({ label: 'f', total: 15, self: 0, callers }, 'f', unitField);
    expect(onlyCallers!.callers).toBeDefined();
    expect(onlyCallers!.callees).toBeUndefined();
  });
});
