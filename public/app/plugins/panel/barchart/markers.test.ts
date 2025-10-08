import { prepSeries } from './utils';
import { FieldType, DataFrame, FieldConfigSource } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { createTheme, GrafanaTheme2 } from '@grafana/ui';
import { BarMarker } from './panelcfg.gen';

describe('Barchart Markers', () => {
  const theme = createTheme() as GrafanaTheme2;
  const fieldConfig: FieldConfigSource = { defaults: {}, overrides: [] };

  const sampleData: DataFrame = {
    name: 'Sample Data',
    length: 3,
    fields: [
      {
        name: 'Category',
        type: FieldType.string,
        values: ['A', 'B', 'C'],
        config: {},
      },
      {
        name: 'Value',
        type: FieldType.number,
        values: [10, 20, 15],
        config: {},
      },
      {
        name: 'Threshold',
        type: FieldType.number,
        values: [12, 18, 16],
        config: {},
      },
    ],
  };

  const sampleMarkers: BarMarker[] = [
    {
      field: 'Threshold',
      shape: 'circle',
      color: '#ff0000',
      size: 6,
      showValue: true,
    },
  ];

  it('should process markers correctly', () => {
    const result = prepSeries([sampleData], fieldConfig, StackingMode.None, theme, undefined, undefined, sampleMarkers);
    
    expect(result.markers).toBeDefined();
    expect(result.markers).toHaveLength(1);
    expect(result.markers![0].config.field).toBe('Threshold');
    expect(result.markers![0].values).toEqual([12, 18, 16]);
  });

  it('should handle empty markers array', () => {
    const result = prepSeries([sampleData], fieldConfig, StackingMode.None, theme, undefined, undefined, []);
    
    expect(result.markers).toBeDefined();
    expect(result.markers).toHaveLength(0);
  });

  it('should handle markers with non-existent fields', () => {
    const invalidMarkers: BarMarker[] = [
      {
        field: 'NonExistentField',
        shape: 'circle',
        color: '#ff0000',
        size: 6,
        showValue: false,
      },
    ];

    const result = prepSeries([sampleData], fieldConfig, StackingMode.None, theme, undefined, undefined, invalidMarkers);
    
    expect(result.markers).toBeDefined();
    expect(result.markers).toHaveLength(0);
  });
});