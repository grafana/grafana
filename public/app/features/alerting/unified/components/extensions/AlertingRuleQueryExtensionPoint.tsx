import { ReactElement, useState } from 'react';

import { PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
// import { Trans, t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
// import { Button } from '@grafana/ui';

import { ConfirmNavigationModal } from './ConfirmationNavigationModal';
import { QuerylessAppsExtensions } from './QuerylessAppExtensions';

type Props = {
  extensionsToShow: 'queryless';
  query: DataQuery;
};

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

// Map data source types to compatible queryless apps
const DATASOURCE_TO_QUERYLESS_APP: Record<string, string[]> = {
  prometheus: ['grafana-metricsdrilldown-app'],
  // todo: add more data source types here
  // 'pyroscope': ['grafana-pyroscope-app'],
  // 'loki': ['grafana-lokiexplore-app'],
  // 'tempo': ['grafana-exploretraces-app'],
};

export type PluginExtensionAlertingRuleContext = {
  targets: DataQuery[];
  // TODO: add rule form values for creating alerting rule from drilldown apps
};

export function AlertingRuleQueryExtentionPoint({ extensionsToShow, query }: Props): ReactElement | null {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const context: PluginExtensionAlertingRuleContext = {
    targets: [query],
  };

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertingRuleQueryEditor,
    context: context,
    limitPerPlugin: 3,
  });
  debugger;
  // filter the link so that the query data source matches the queryless app data source
  // we only want one link per query row editor for now
  // but we can show an array of links for more flexibility in the future
  const querylessLinks = links.filter((link) => {
    if (!QUERYLESS_APPS.includes(link.pluginId)) {
      return false;
    }

    // Get the data source type from the query
    const datasourceType = query.datasource?.type;
    if (!datasourceType) {
      return false;
    }

    // Check if this queryless app is compatible with the data source type
    const compatibleApps = DATASOURCE_TO_QUERYLESS_APP[datasourceType.toLowerCase()] || [];
    return compatibleApps.includes(link.pluginId);
  });

  return (
    <>
      {extensionsToShow === 'queryless' && (
        <QuerylessAppsExtensions
          links={querylessLinks}
          setSelectedExtension={(extension) => {
            setSelectedExtension(extension);
          }}
          setIsModalOpen={setIsModalOpen}
          isModalOpen={isModalOpen}
        />
      )}
      {/* TODO: add basic extensions */}
      {!!selectedExtension && !!selectedExtension.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </>
  );
}
