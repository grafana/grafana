export interface Options {
  showHeader: boolean;
  fixedHeader: boolean;
  fixedColumns: number;
  rotate: boolean;
}

export const defaults: Options = {
  showHeader: true,
  fixedHeader: true,
  fixedColumns: 0,
  rotate: false,
};
