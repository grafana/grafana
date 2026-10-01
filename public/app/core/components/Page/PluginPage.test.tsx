import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { PluginPageContext, buildPluginPageContext } from 'app/features/plugins/components/PluginPageContext';

import { PluginPage } from './PluginPage';

const setup = (pluginId?: string) => {
  config.bootData.navTree = [
    {
      id: HOME_NAV_ID,
      text: 'Home',
      url: '/',
    },
  ];

  const content = <PluginPage>Plugin page content</PluginPage>;

  return render(
    pluginId ? (
      <PluginPageContext.Provider value={buildPluginPageContext(undefined, pluginId)}>
        {content}
      </PluginPageContext.Provider>
    ) : (
      content
    )
  );
};

describe('PluginPage', () => {
  it('should mark the plugin boundary when rendered within a plugin page context', () => {
    setup('my-app');

    const boundary = screen.getByTestId(selectors.components.Plugins.appPage('my-app'));
    expect(boundary).toHaveAttribute('data-plugin-id', 'my-app');
    expect(screen.getByText('Plugin page content')).toBeVisible();
  });

  it('should not render boundary attributes without a plugin page context', () => {
    setup();

    expect(screen.getByText('Plugin page content')).toBeVisible();
    expect(screen.queryByTestId(selectors.components.Plugins.appPage('undefined'))).not.toBeInTheDocument();
  });
});
