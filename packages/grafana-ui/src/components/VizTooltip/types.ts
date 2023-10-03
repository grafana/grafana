export enum ColorIndicator {
  series = 'series',
  value = 'value',
  hexagon = 'hexagon',
  pie_1_4 = 'pie_1_4',
  pie_2_4 = 'pie_2_4',
  pie_3_4 = 'pie_3_4',
  marker_sm = 'marker_sm',
  marker_md = 'marker_md',
  marker_lg = 'marker_lg',
}

export enum LabelValuePlacement {
  hidden = 'hidden',
  leading = 'leading',
  trailing = 'trailing',
}

export interface LabelValue {
  label: string;
  value: string | number | null;
  color?: string;
  colorIndicator?: ColorIndicator;
}
