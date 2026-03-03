import { createTheme } from '@grafana/data';

import { Options } from './panelcfg.gen';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: Options = {} as Options;

  it('simple test stub', () => {
    expect(theme).toBeDefined();
    expect(options).toBeDefined();
  });
});
