import { ReactElement, useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';

import { ConfirmNavigationModal } from './ConfirmationNavigationModal';

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

export function AlertingRuleQueryExtentionPoint(props: Props): ReactElement | null {
  const { extensionsToShow, query } = props;
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const context = { targets: [query] };

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertingRuleQueryEditor,
    context: context,
    limitPerPlugin: 3,
  });

  // const hasQueryInRule = query.expr !== undefined;

  // filter the link so that the query data source matches the queryless app data source
  // we only want one link per query row editor
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

  // Use the first available queryless link
  const selectedQuerylessLink = querylessLinks[0];

  const handleGoQuerylessClick = () => {
    setIsModalOpen(true);
  };

  const handleModalDismiss = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {extensionsToShow === 'queryless' && querylessLinks.length > 0 && (
        <div>
          <Button
            aria-label={t('alerting.rule-editor.go-queryless.aria-label', 'Go queryless')}
            variant="secondary"
            onClick={handleGoQuerylessClick}
            title={selectedQuerylessLink.description}
          >
            <Trans i18nKey="alerting.rule-editor.go-queryless">Go queryless</Trans>
          </Button>
        </div>
      )}

      {isModalOpen && selectedQuerylessLink && selectedQuerylessLink.path && selectedQuerylessLink.title && (
        <ConfirmNavigationModal
          onDismiss={handleModalDismiss}
          path={selectedQuerylessLink.path}
          title={selectedQuerylessLink.title}
        />
      )}
    </>
  );
}
