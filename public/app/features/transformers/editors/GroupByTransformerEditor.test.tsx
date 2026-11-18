import { render, screen } from '@testing-library/react';

import { FieldType, toDataFrame } from '@grafana/data';
import { type GroupByTransformerOptions } from '@grafana/data/internal';

import { GroupByTransformerEditorBase } from './GroupByTransformerEditor';

const input = [
  toDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: ['a', 'b'] },
      { name: 'value', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

function renderEditor(fields: Record<string, unknown>) {
  // Cast because these tests cover saved configs that don't match the declared type.
  const options = { fields } as GroupByTransformerOptions;
  render(
    <GroupByTransformerEditorBase input={input} options={options} onChange={jest.fn()} fieldNames={['host', 'value']} />
  );
}

const calcAlertTitle = 'Calculations will not have an effect if no fields are being grouped on';

describe('GroupByTransformerEditor', () => {
  it('renders a saved field config that has an operation but no aggregations', () => {
    renderEditor({
      host: { operation: 'groupby' },
      value: { operation: 'aggregate', aggregations: ['sum'] },
    });

    expect(screen.getByDisplayValue('Group by')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Calculate')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText(calcAlertTitle)).not.toBeInTheDocument();
  });

  it('warns about calculations without grouping only when a calculation operation is set', () => {
    renderEditor({
      value: { operation: 'aggregate', aggregations: ['sum'] },
    });

    expect(screen.getByText(calcAlertTitle)).toBeInTheDocument();
  });

  it('does not warn about calculations for a field whose cleared operation was dropped on save', () => {
    renderEditor({
      value: { aggregations: ['sum'] },
    });

    expect(screen.getAllByPlaceholderText('Ignored')).toHaveLength(2);
    expect(screen.queryByText(calcAlertTitle)).not.toBeInTheDocument();
  });
});
