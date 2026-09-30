import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  screen.getAllByRole('button').map((pill) => `${pill.textContent}:${pill.getAttribute('aria-pressed')}`);

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

    expect(committed).toEqual([['x:true', 'y:true'], ['z:true']]);
  });

  it('keeps an in-progress regex when options change but field names do not', async () => {
    const input = frameWithFields('x', 'y');
    const { rerender } = render(<FilterByNameTransformerEditor input={input} options={{}} onChange={jest.fn()} />);

    await userEvent.type(screen.getByRole('textbox'), 'x|');
    rerender(<FilterByNameTransformerEditor input={input} options={{ byVariable: false }} onChange={jest.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('x|');
  });
});
