import { FormattedValue, getValueFormat, SelectableValue, toFixedUnit } from '@grafana/data';

type MeasureAction = 'area' | 'length';

export interface MapMeasureOptions {
  action: MeasureAction;
  unit: string;
  color?: string;
}

export interface MapMeasure extends SelectableValue<MeasureAction> {
  geometry: 'Polygon' | 'LineString';
  units: MapUnit[];

  /**
   * This will get the best unit for the selected string or a default
   * This is helpful when converting from area<>length, we should try to stay
   * in the same category of unit if possible
   */
  getUnit: (v?: string) => MapUnit;
}

export interface MapUnit extends SelectableValue<string> {
  format: (si: number) => FormattedValue;
}

export const measures: MapMeasure[] = [
  {
    value: 'length',
    label: 'Length',
    geometry: 'LineString',
    units: [
      {
        label: 'Metric (m/km)',
        value: 'm',
        format: (m: number) => getValueFormat('lengthm')(m),
      },
      {
        label: 'Feet (ft)',
        value: 'ft',
        format: (m: number) => getValueFormat('lengthft')(m * 3.28084),
      },
      {
        label: 'Miles (mi)',
        value: 'mi',
        format: (m: number) => getValueFormat('lengthmi')(m / 1609.0),
      },
      {
        label: 'Nautical miles (nmi)',
        value: 'nmi',
        format: (m: number) => getValueFormat('nmi')(m / 1852.0),
      },
    ],
    getUnit: (v?: string) => {
      const units = measures[0].units;
      if (v?.endsWith('2')) {
        v = v.substring(0, v.length - 1);
      }
      return units.find((u) => u.value === v) ?? units[0];
    },
  },
  {
    value: 'area',
    label: 'Area',
    geometry: 'Polygon',
    units: [
      {
        label: 'Square Meters (m²)',
        value: 'm2',
        format: (m2: number) => getValueFormat('areaM2')(m2),
      },
      {
        label: 'Square Kilometers (km²)',
        value: 'km2',
        format: (m2: number) => toFixedUnit('km²')(m2 * 1e-6),
      },
      {
        label: 'Square Feet (ft²)',
        value: 'ft2',
        format: (m2: number) => getValueFormat('areaF2')(m2 * 10.76391),
      },
      {
        label: 'Square Miles (mi²)',
        value: 'mi2',
        format: (m2: number) => getValueFormat('areaMI2')(m2 * 3.861e-7),
      },
      {
        label: 'Acres',
        value: 'acre2',
        format: (m2: number) => toFixedUnit('acre')(m2 * 2.47105e-4),
      },
      {
        label: 'Hectare',
        value: 'hectare2',
        format: (m2: number) => toFixedUnit('ha')(m2 * 1e-4),
      },
    ],
    getUnit: (v?: string) => {
      const units = measures[1].units;
      if (!v?.endsWith('2')) {
        v += '2';
      }
      return units.find((u) => u.value === v) ?? units[0];
    },
  },
];
