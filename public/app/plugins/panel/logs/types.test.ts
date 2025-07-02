import { CoreApp } from '@grafana/data';

import { isCoreApp } from './types';

describe('isCoreApp', () => {
  test('Identifies core apps', () => {
    expect(isCoreApp(CoreApp.Explore)).toBe(true);
    expect(isCoreApp(CoreApp.Unknown)).toBe(true);
    expect(isCoreApp(CoreApp.PanelEditor)).toBe(true);
    expect(isCoreApp(CoreApp.PanelViewer)).toBe(true);
    expect(isCoreApp(CoreApp.Dashboard)).toBe(true);
  });

  test('Identifies non-apps', () => {
    expect(isCoreApp('the explore')).toBe(false);
    expect(isCoreApp('nope')).toBe(false);
    expect(isCoreApp('drilldown')).toBe(false);
  });
});
