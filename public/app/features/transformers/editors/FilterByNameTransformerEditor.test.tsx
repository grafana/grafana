import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { type FilterFieldsByNameTransformerOptions } from '@grafana/data/internal';
import { setTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import { FilterByNameTransformerEditor } from './FilterByNameTransformerEditor';

// Upstream transformations hand the editor a new frame array on every run, even when the fields are unchanged.
const createInput = (names: string[]): DataFrame[] => [
  toDataFrame({ fields: names.map((name) => ({ name, type: FieldType.number, values: [1] })) }),
];

const getPill = (name: string) => screen.getByRole('button', { name });

describe('FilterByNameTransformerEditor', () => {
  beforeAll(() => {
    setTemplateSrv({ getVariables: () => [] } as unknown as TemplateSrv);
  });

  it('keeps every field deselected when the saved options come back with a new input of the same fields', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterByNameTransformerEditor
        input={createInput(['A', 'B'])}
        options={{ include: { names: ['A'] } }}
        onChange={onChange}
      />
    );

    await userEvent.click(getPill('A'));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];
    expect(saved).toEqual({ include: { names: [] } });

    rerender(<FilterByNameTransformerEditor input={createInput(['A', 'B'])} options={saved} onChange={onChange} />);

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'false');
    expect(getPill('B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects every field again when the input brings a new field', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterByNameTransformerEditor
        input={createInput(['A'])}
        options={{ include: { names: ['A'] } }}
        onChange={onChange}
      />
    );

    await userEvent.click(getPill('A'));
    const saved: FilterFieldsByNameTransformerOptions = onChange.mock.lastCall[0];

    rerender(<FilterByNameTransformerEditor input={createInput(['A', 'C'])} options={saved} onChange={onChange} />);

    expect(getPill('A')).toHaveAttribute('aria-pressed', 'true');
    expect(getPill('C')).toHaveAttribute('aria-pressed', 'true');
  });
});
