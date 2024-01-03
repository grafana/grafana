import { DashboardScene } from '../../scene/DashboardScene';

export function getVariableTypes(dashboard: DashboardScene) {
  // TODO: this should get the existing variable types from grafana scenes

  return [
    { value: 'constant', label: 'Constant' },
    { value: 'query', label: 'Query' },
    { value: 'interval', label: 'Interval' },
    { value: 'datasource', label: 'Datasource' },
    { value: 'textbox', label: 'Text Box' },
    { value: 'custom', label: 'Custom' },
  ];
}
