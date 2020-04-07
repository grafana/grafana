export interface Options {
  showHeader: boolean;
  resizable: boolean;
}

export interface CustomFieldConfig {
  width: number;
  displayMode: string;
}

export const defaults: Options = {
  showHeader: true,
  resizable: false,
};
