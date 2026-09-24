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

  it('never commits new field names against the previous selection', () => {
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
