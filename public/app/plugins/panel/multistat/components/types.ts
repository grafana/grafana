export interface IStat {
  alias?: string;
  label?: string;
  value: number;
  valueRounded: number;
  valueFormatted: string;
  flotpairs: any[];
  scopedVars?: any;
}

export interface ISize {
  w: number;
  h: number;
}
