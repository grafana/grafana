import { FieldConfigSource } from '@grafana/data';

export interface Options {
  fieldOptions: FieldConfigSource;
  showHeader: boolean;
}

export const defaults: Options = {
  fieldOptions: {
    defaults: {},
    overrides: [],
  },
  showHeader: true,
};
