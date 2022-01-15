import { createTheme } from '@grafana/data';
import { PanelOptions } from './models.gen';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: PanelOptions = {} as PanelOptions;

  expect(theme).toBeDefined();
  expect(options).toBeDefined();
});
