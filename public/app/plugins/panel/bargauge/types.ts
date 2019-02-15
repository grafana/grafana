export interface BarGaugeOptions {
  minValue: number;
  maxValue: number;
  prefix: string;
  stat: string;
  suffix: string;
  unit: string;
}

export const PanelDefaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  prefix: '',
  suffix: '',
  stat: 'avg',
  unit: 'none',
};
