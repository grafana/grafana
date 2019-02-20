export interface PiechartOptions {
  pieType: string;
  strokeWidth: number;

  valueOptions: PiechartValueOptions;
  // TODO: Options for Legend / Combine components
}

export interface PiechartValueOptions {
  unit: string;
  stat: string;
}

export const defaults: PiechartOptions = {
  pieType: 'pie',
  strokeWidth: 1,
  valueOptions: {
    unit: 'short',
    stat: 'current',
  },
};
