import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldType, standardEditorsRegistry, toDataFrame } from '@grafana/data';
import {
  GraphDrawStyle,
  TableCellDisplayMode,
  TableSparklineColorMode,
  type TableSparklineCellOptions,
} from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { SparklineCellOptionsEditor } from './SparklineCellOptionsEditor';

// the graph field-config editors this component lists resolve standard option
// editors from this registry; the panel framework normally initialises it
standardEditorsRegistry.setInit(getAllOptionEditors);
mockComboboxRect();

function setup(cellOptions: Partial<TableSparklineCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <SparklineCellOptionsEditor
      cellOptions={{ type: TableCellDisplayMode.Sparkline, ...cellOptions }}
      onChange={onChange}
    />
  );
  return { onChange };
}

describe('SparklineCellOptionsEditor', () => {
  const context = {
    data: [
      toDataFrame({
        fields: [
          { name: 'service', type: FieldType.string, values: ['api'] },
          { name: 'trend', type: FieldType.number, values: [1] },
        ],
      }),
    ],
    options: { frameIndex: 0, showHeader: true },
  };

  it('renders the "Hide value" control it adds on top of the graph config', () => {
    setup();
    expect(screen.getByLabelText('Hide value')).toBeInTheDocument();
  });

  it('renders the sparkline color mode control', () => {
    setup();
    expect(screen.getByText('Sparkline color mode')).toBeInTheDocument();
    expect(screen.getByText('Field color')).toBeInTheDocument();
    expect(screen.getByText('By field value')).toBeInTheDocument();
  });

  it('shows the sparkline color field picker when coloring by field value', () => {
    render(
      <SparklineCellOptionsEditor
        cellOptions={{
          type: TableCellDisplayMode.Sparkline,
          sparklineColorMode: TableSparklineColorMode.ByFieldValue,
        }}
        context={context}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Sparkline color field')).toBeInTheDocument();
  });

  it('clears the sparkline color field with an empty value', async () => {
    const onChange = jest.fn();
    render(
      <SparklineCellOptionsEditor
        cellOptions={{
          type: TableCellDisplayMode.Sparkline,
          sparklineColorMode: TableSparklineColorMode.ByFieldValue,
          sparklineColorField: 'service',
        }}
        context={context}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByTitle('Clear value'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sparklineColorField: '',
      })
    );
  });

  it('forwards a changed option while preserving the existing cell options', async () => {
    const { onChange } = setup({ lineWidth: 5 });
    await userEvent.click(screen.getByLabelText('Hide value'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lineWidth: 5, hideValue: true }));
  });

  // barAlignment only applies to the Bars draw style. Query by the field's label
  // text (not getByLabelText): a wrapped radiogroup editor has no label association,
  // so getByLabelText would be null whether the option is shown or hidden.
  it('shows the bar-alignment option for the Bars draw style', () => {
    setup({ drawStyle: GraphDrawStyle.Bars });
    expect(screen.getByText('Bar alignment')).toBeInTheDocument();
  });

  it('hides the bar-alignment option for non-Bars draw styles', () => {
    setup({ drawStyle: GraphDrawStyle.Line });
    expect(screen.queryByText('Bar alignment')).not.toBeInTheDocument();
  });
});
