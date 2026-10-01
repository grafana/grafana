import { render, screen } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';
import { AxisPlacement, LegendDisplayMode } from '@grafana/schema';

import { BarGaugeLegend } from './BarGaugeLegend';

function renderLegend(frames: Array<ReturnType<typeof createDataFrame>>) {
  return render(
    <BarGaugeLegend
      data={frames}
      placement="bottom"
      displayMode={LegendDisplayMode.List}
      calcs={[]}
      showLegend={true}
    />
  );
}

describe('BarGaugeLegend', () => {
  it('renders a legend item per non-time field', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'cpu', type: FieldType.number, values: [1, 2, 3] },
        { name: 'mem', type: FieldType.number, values: [4, 5, 6] },
      ],
    });

    renderLegend([frame]);

    expect(screen.getByText('cpu')).toBeInTheDocument();
    expect(screen.getByText('mem')).toBeInTheDocument();
    // time field should be excluded from the legend
    expect(screen.queryByText('time')).not.toBeInTheDocument();
  });

  it('excludes fields hidden from the legend', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'visible', type: FieldType.number, values: [1, 2, 3] },
        {
          name: 'hidden',
          type: FieldType.number,
          values: [4, 5, 6],
          config: { custom: { hideFrom: { legend: true } } },
        },
      ],
    });

    renderLegend([frame]);

    expect(screen.getByText('visible')).toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('renders fields configured for the right axis placement', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'rightAxis',
          type: FieldType.number,
          values: [1, 2, 3],
          config: { custom: { axisPlacement: AxisPlacement.Right } },
        },
      ],
    });

    renderLegend([frame]);

    expect(screen.getByText('rightAxis')).toBeInTheDocument();
  });
});
