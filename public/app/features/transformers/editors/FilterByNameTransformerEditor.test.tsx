import { render } from '@testing-library/react';
import { useLayoutEffect } from 'react';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { FilterByNameTransformerEditor } from './FilterByNameTransformerEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

const frameWithFields = (...names: string[]): DataFrame[] => [
  toDataFrame({ fields: names.map((name) => ({ name, type: FieldType.number, values: [1] })) }),
];

const pillStates = () =>
  Array.from(document.querySelectorAll('button[aria-pressed]')).map(
    (pill) => `${pill.textContent}:${pill.getAttribute('aria-pressed')}`
  );

describe('FilterByNameTransformerEditor', () => {
  it('selects every field when no names are configured', () => {
    render(<FilterByNameTransformerEditor input={frameWithFields('x', 'y')} options={{}} onChange={jest.fn()} />);

    expect(pillStates()).toEqual(['x:true', 'y:true']);
  });

  // Known bug: field names are derived during render but the selection is re-seeded in a passive effect, so
  // the commit after new input frames arrive shows the new fields against the old selection. The class kept
  // both in state and updated them together, so no commit mixed them. With "all fields" selected, new
  // fields flash as unselected, and a click in that frame toggles against the stale selection.
  // Change to `it` once fixed.
  it.failing('never commits new field names against the previous selection', () => {
    const committed: string[][] = [];
    function CommitRecorder() {
      useLayoutEffect(() => {
        committed.push(pillStates());
      });
      return null;
    }
    const editor = (input: DataFrame[]) => (
      <>
        <FilterByNameTransformerEditor input={input} options={{}} onChange={jest.fn()} />
        <CommitRecorder />
      </>
    );

    const { rerender } = render(editor(frameWithFields('x', 'y')));
    rerender(editor(frameWithFields('z')));

    expect(pillStates()).toEqual(['z:true']);
    expect(committed).not.toContainEqual(['z:false']);
  });
});
