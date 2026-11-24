import { render, screen } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  type Field,
  type FieldConfig,
  FieldColorModeId,
  FieldType,
  MappingType,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';

import { StatusCell } from './StatusCell';

const theme = createTheme();

const severityThresholds = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 50, color: 'orange' },
    { value: 80, color: 'red' },
  ],
};

function makeField(values: unknown[], config: FieldConfig = {}, type = FieldType.number): Field {
  const frame = toDataFrame({ fields: [{ name: 'status', type, values, config }] });
  return applyFieldOverrides({
    data: [frame],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (v) => v,
    theme,
    timeZone: 'utc',
  })[0].fields[0];
}

function renderCell(field: Field, rowIdx: number, tableRefreshEnabled = false) {
  return render(
    <StatusCell field={field} rowIdx={rowIdx} value={field.values[rowIdx]} tableRefreshEnabled={tableRefreshEnabled} />
  );
}

const getShape = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-status-shape]');

describe('StatusCell', () => {
  describe('shape follows the threshold step', () => {
    it.each([
      [10, 'circle', 'green'],
      [60, 'triangle', 'orange'],
      [95, 'diamond', 'red'],
    ])('value %s renders a %s in the step colour', (value, shape, color) => {
      const field = makeField([value], { thresholds: severityThresholds });
      const { container } = renderCell(field, 0);

      expect(getShape(container)).toHaveAttribute('data-status-shape', shape);
      expect(getShape(container)).toHaveStyle({ backgroundColor: theme.visualization.getColorByName(color) });
      expect(screen.getByText(String(value))).toBeInTheDocument();
    });

    it('keeps drawing a diamond past the third step', () => {
      const field = makeField([200], {
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [...severityThresholds.steps, { value: 150, color: 'purple' }],
        },
      });
      const { container } = renderCell(field, 0);

      expect(getShape(container)).toHaveAttribute('data-status-shape', 'diamond');
    });

    it('uses the percentage of the range in percentage mode', () => {
      const field = makeField([0, 55, 100], {
        min: 0,
        max: 100,
        thresholds: { ...severityThresholds, mode: ThresholdsMode.Percentage },
      });
      const { container } = renderCell(field, 1);

      expect(getShape(container)).toHaveAttribute('data-status-shape', 'triangle');
    });

    it('stays a circle when the field is not coloured by thresholds', () => {
      const field = makeField([95], {
        thresholds: severityThresholds,
        color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
      });
      const { container } = renderCell(field, 0);

      expect(getShape(container)).toHaveAttribute('data-status-shape', 'circle');
    });
  });

  describe('value mappings', () => {
    const mappings = [
      {
        type: MappingType.ValueToText as const,
        options: {
          ok: { text: 'Healthy', color: 'green', index: 0 },
          degraded: { text: 'Degraded', color: 'orange', index: 1 },
          down: { text: 'Down', color: 'red', index: 2 },
          unknown: { text: 'Unknown', index: 3 },
        },
      },
    ];

    it.each([
      [0, 'Healthy', 'circle'],
      [1, 'Degraded', 'triangle'],
      [2, 'Down', 'diamond'],
    ])('row %s shows the mapped text "%s" with a %s', (rowIdx, text, shape) => {
      const field = makeField(['ok', 'degraded', 'down'], { mappings }, FieldType.string);
      const { container } = renderCell(field, rowIdx);

      expect(screen.getByText(text)).toBeInTheDocument();
      expect(getShape(container)).toHaveAttribute('data-status-shape', shape);
    });

    it('orders severity by the mapping index, not the order the keys are stored in', () => {
      // Saved dashboards can return value-mapping keys sorted alphabetically.
      const stored = [
        {
          type: MappingType.ValueToText as const,
          options: {
            breaching: { text: 'Breaching', color: 'red', index: 2 },
            healthy: { text: 'Healthy', color: 'green', index: 0 },
            watch: { text: 'Watch', color: 'orange', index: 1 },
          },
        },
      ];
      const field = makeField(['healthy', 'watch', 'breaching'], { mappings: stored }, FieldType.string);

      expect(getShape(renderCell(field, 0).container)).toHaveAttribute('data-status-shape', 'circle');
      expect(getShape(renderCell(field, 1).container)).toHaveAttribute('data-status-shape', 'triangle');
      expect(getShape(renderCell(field, 2).container)).toHaveAttribute('data-status-shape', 'diamond');
    });

    it('falls back to the threshold step when the matched mapping sets no colour', () => {
      const numericMappings = [
        { type: MappingType.RangeToText as const, options: { from: 90, to: 100, result: { text: 'Critical' } } },
        {
          type: MappingType.RangeToText as const,
          options: { from: 0, to: 10, result: { text: 'Idle', color: 'blue' } },
        },
      ];
      const field = makeField([95], { mappings: numericMappings, thresholds: severityThresholds });
      const { container } = renderCell(field, 0);

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(getShape(container)).toHaveAttribute('data-status-shape', 'diamond');
    });
  });

  describe('accessibility', () => {
    it('hides the shape from assistive technology and titles the text', () => {
      const field = makeField([95], { thresholds: severityThresholds, unit: 'percent' });
      const { container } = renderCell(field, 0);

      expect(getShape(container)).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTitle('95%')).toHaveTextContent('95%');
    });

    it('renders nothing for an empty value', () => {
      const field = makeField([null], { thresholds: severityThresholds });
      const { container } = renderCell(field, 0);

      expect(container).toBeEmptyDOMElement();
    });
  });

  it.each([false, true])('wraps the shape and text in the link hit area (tableRefreshEnabled: %s)', (refresh) => {
    const field = makeField([95], {
      thresholds: severityThresholds,
      links: [
        { title: 'One', url: 'https://example.com/1' },
        { title: 'Two', url: 'https://example.com/2' },
      ],
    });
    const { container } = renderCell(field, 0, refresh);

    const link = screen.getByTitle('view data links and actions');
    expect(link).toContainElement(getShape(container));
    expect(link).toHaveTextContent('95');
  });
});
