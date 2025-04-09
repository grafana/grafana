import { AppPlugin, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';
import { App } from './components/App';
import { QueryModal } from './components/QueryModal';
import { selectQuery } from './utils/utils';
import pluginJson from './plugin.json';

export const plugin = new AppPlugin<{}>()
  .setRootPage(App)
  .addLink<PluginExtensionPanelContext>({
    title: 'Open from time series or pie charts (path)',
    description: 'This link will only be visible on time series and pie charts',
    targets: PluginExtensionPoints.DashboardPanelMenu,
    path: `/a/${pluginJson.id}/`,
    configure: (context) => {
      // Will only be visible for the Link Extensions dashboard
      if (context?.dashboard?.title !== 'Link Extensions (path)') {
        return undefined;
      }

      switch (context?.pluginId) {
        case 'timeseries':
          return {}; // Does not apply any overrides
        case 'piechart':
          return {
            title: `Open from ${context.pluginId}`,
          };

        default:
          // By returning undefined the extension will be hidden
          return undefined;
      }
    },
  })
  .addLink<PluginExtensionPanelContext>({
    title: 'Open from time series or pie charts (onClick)',
    description: 'This link will only be visible on time series and pie charts',
    targets: PluginExtensionPoints.DashboardPanelMenu,
    onClick: (_, { openModal, context }) => {
      const targets = context?.targets ?? [];
      const title = context?.title;

      if (!isSupported(context)) {
        return;
      }

      // Show a modal to display a UI for selecting between the available queries (targets)
      // in case there are more available.
      if (targets.length > 1) {
        return openModal({
          title: `Select query from "${title}"`,
          body: (props) => <QueryModal {...props} targets={targets} />,
        });
      }

      const [target] = targets;
      selectQuery(target);
    },
    configure: (context) => {
      // Will only be visible for the Command Extensions dashboard
      if (context?.dashboard?.title !== 'Link Extensions (onClick)') {
        return undefined;
      }

      if (!isSupported(context)) {
        return;
      }

      switch (context?.pluginId) {
        case 'timeseries':
          return {}; // Does not apply any overrides
        case 'piechart':
          return {
            title: `Open from ${context.pluginId}`,
          };

        default:
          // By returning undefined the extension will be hidden
          return undefined;
      }
    },
  });

function isSupported(context?: PluginExtensionPanelContext): boolean {
  const targets = context?.targets ?? [];
  return targets.length > 0;
}
