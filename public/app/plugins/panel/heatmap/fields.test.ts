import { createTheme } from '@grafana/data';

import { PanelOptions } from './types';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: PanelOptions = {} as PanelOptions;

  it('simple test stub', () => {
    expect(theme).toBeDefined();
    expect(options).toBeDefined();
  });
});
