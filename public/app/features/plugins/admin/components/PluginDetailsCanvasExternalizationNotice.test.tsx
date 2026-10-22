import { render, screen } from '@testing-library/react';

import { type CatalogPlugin } from '../types';

import { PluginDetailsCanvasExternalizationNotice } from './PluginDetailsCanvasExternalizationNotice';

const makePlugin = (overrides: Partial<CatalogPlugin>) =>
  ({ id: 'canvas', isCore: true, ...overrides }) as CatalogPlugin;

describe('PluginDetailsCanvasExternalizationNotice', () => {
  it('shows the notice for the core canvas plugin', () => {
    render(<PluginDetailsCanvasExternalizationNotice plugin={makePlugin({})} />);

    expect(screen.getByText('Canvas is moving out of core')).toBeInTheDocument();
  });

  it('hides the notice for the external canvas plugin', () => {
    render(<PluginDetailsCanvasExternalizationNotice plugin={makePlugin({ isCore: false })} />);

    expect(screen.queryByText('Canvas is moving out of core')).not.toBeInTheDocument();
  });

  it('hides the notice for other core plugins', () => {
    render(<PluginDetailsCanvasExternalizationNotice plugin={makePlugin({ id: 'timeseries' })} />);

    expect(screen.queryByText('Canvas is moving out of core')).not.toBeInTheDocument();
  });
});
