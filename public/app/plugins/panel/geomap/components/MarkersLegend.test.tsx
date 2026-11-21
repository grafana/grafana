import { render, screen } from '@testing-library/react';

import { createTheme, FieldColorModeId, FieldType, getDisplayProcessor, toDataFrame } from '@grafana/data';
import { getColorDimension } from 'app/features/dimensions/color';

import { type StyleConfigState } from '../style/types';

import { MarkersLegend } from './MarkersLegend';

const theme = createTheme();

describe('MarkersLegend', () => {
  it('labels the color scale with the oldest and newest time when colored by a time field', () => {
    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 2)],
          config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
        },
      ],
    });
    frame.fields[0].display = getDisplayProcessor({ field: frame.fields[0], theme, timeZone: 'utc' });

    const styleConfig: StyleConfigState = {
      config: {},
      base: { color: '' },
      dims: { color: getColorDimension(frame, { fixed: '', field: 'time' }, theme) },
      maker: () => [],
    };

    render(<MarkersLegend layerName="markers" styleConfig={styleConfig} />);

    expect(screen.getByText('2024-01-01 00:00:00')).toBeInTheDocument();
    expect(screen.getByText('2024-01-02 00:00:00')).toBeInTheDocument();
  });
});
