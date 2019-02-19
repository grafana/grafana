export interface PiechartOptions {
  pieType: string;
  unit: string;
  stat: string;
  strokeWidth: number;
  // TODO: Options for Legend / Combine components
}

export const defaults: PiechartOptions = {
  pieType: 'pie',
  unit: 'short',
  stat: 'current',
  strokeWidth: 1,
};
