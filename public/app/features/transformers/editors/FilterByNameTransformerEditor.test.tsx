import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutEffect } from 'react';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { type FilterFieldsByNameTransformerOptions } from '@grafana/data/internal';

import { FilterByNameTransformerEditor } from './FilterByNameTransformerEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

const frameWithFields = (...names: string[]): DataFrame[] => [
  toDataFrame({ fields: names.map((name) => ({ name, type: FieldType.number, values: [1] })) }),
];

const getPill = (name: string) => screen.getByRole('button', { name });

// Only the field pills carry aria-pressed; the Select all and Deselect all buttons do not.
const pillStates = () =>
  screen
    .getAllByRole('button')
    .filter((pill) => pill.hasAttribute('aria-pressed'))
    .map((pill) => `${pill.textContent}:${pill.getAttribute('aria-pressed')}`);

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

  it.each([
    { button: 'Select all', pressed: 'true' },
    { button: 'Deselect all', pressed: 'false' },
  ])('$button saves an empty include, clears the regex, and keeps the exclude', async ({ button, pressed }) => {
    const onChange = jest.fn();
    render(
      <FilterByNameTransformerEditor
        input={frameWithFields('A', 'B')}
        options={{ include: { names: ['A'], pattern: 'B' }, exclude: { names: ['C'] } }}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: button }));

    expect(onChange).toHaveBeenCalledWith({ include: { names: [] }, exclude: { names: ['C'] } });
    expect(screen.getByPlaceholderText('Regular expression pattern')).toHaveValue('');
    expect(getPill('A')).toHaveAttribute('aria-pressed', pressed);
    expect(getPill('B')).toHaveAttribute('aria-pressed', pressed);
  });

  it('saves only the field picked after Deselect all', async () => {
    const onChange = jest.fn();
    render(<FilterByNameTransformerEditor input={frameWithFields('A', 'B', 'C')} options={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
    await userEvent.click(getPill('B'));

    expect(onChange).toHaveBeenLastCalledWith({ include: { names: ['B'] } });
  });

  it('keeps every field deselected when the saved options come back with a new input of the same fields', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterByNameTransformerEditor
        input={frameWithFields('A', 'B')}
        options={{ include: { names: ['A'] } }}
        onChange={onChange}
      />
    );

    await userEvent.click(getPill('A'));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];
    expect(saved).toEqual({ include: { names: [] } });

    rerender(<FilterByNameTransformerEditor input={frameWithFields('A', 'B')} options={saved} onChange={onChange} />);

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'false');
    expect(getPill('B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps every field deselected when the input brings the same fields in a new order', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterByNameTransformerEditor input={frameWithFields('A', 'B')} options={{}} onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];

    rerender(<FilterByNameTransformerEditor input={frameWithFields('B', 'A')} options={saved} onChange={onChange} />);

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'false');
    expect(getPill('B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the new selection when the options are swapped for another transformation', () => {
    const { rerender } = render(
      <FilterByNameTransformerEditor
        input={frameWithFields('A', 'B')}
        options={{ include: { names: ['A', 'B'] } }}
        onChange={jest.fn()}
      />
    );

    rerender(
      <FilterByNameTransformerEditor
        input={frameWithFields('A', 'B')}
        options={{ include: { names: ['A'] } }}
        onChange={jest.fn()}
      />
    );

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'true');
    expect(getPill('B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows its own saved selection again when the options are swapped back', async () => {
    const onChange = jest.fn();
    const editor = (options: FilterFieldsByNameTransformerOptions) => (
      <FilterByNameTransformerEditor input={frameWithFields('A', 'B')} options={options} onChange={onChange} />
    );
    const { rerender } = render(editor({}));

    await userEvent.click(getPill('B'));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];
    rerender(editor(saved));
    rerender(editor({ include: { names: ['B'] } }));
    rerender(editor(saved));

    expect(pillStates()).toEqual(['A:true', 'B:false']);
  });

  it('selects every field again when the input brings a new field', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterByNameTransformerEditor
        input={frameWithFields('A')}
        options={{ include: { names: ['A'] } }}
        onChange={onChange}
      />
    );

    await userEvent.click(getPill('A'));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];

    rerender(<FilterByNameTransformerEditor input={frameWithFields('A', 'C')} options={saved} onChange={onChange} />);

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'true');
    expect(getPill('C')).toHaveAttribute('aria-pressed', 'true');
  });
});
