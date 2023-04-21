import { config } from '@grafana/runtime';

export const isDatagridEditEnabled = () => {
  return config.featureToggles.enableDatagridEditing;
};
