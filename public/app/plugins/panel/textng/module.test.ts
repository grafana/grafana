import { PanelPlugin } from '@grafana/data';

import { TextNGPanel } from './TextNGPanel';
import { plugin } from './module';

describe('textng module', () => {
  it('exports a PanelPlugin', () => {
    expect(plugin).toBeInstanceOf(PanelPlugin);
  });

  it('registers the TextNGPanel component', () => {
    expect(plugin.panel).toBe(TextNGPanel);
  });
});
