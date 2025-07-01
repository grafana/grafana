import { ReactElement, useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';

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

export function AlertingRuleQueryExtentionPoint(props: Props): ReactElement | null {
  const { extensionsToShow, query } = props;
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const context = { targets: [query] };

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertingRuleQueryEditor,
    context: context,
    limitPerPlugin: 3,
  });

  // Filter queryless links if needed
  const querylessLinks = links.filter((link) => QUERYLESS_APPS.includes(link.pluginId));

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
      {extensionsToShow === 'queryless' && (
        <div>
          <ToolbarButton
            aria-label={t('alerting.rule-editor.go-queryless.aria-label', 'Go queryless')}
            disabled={querylessLinks.length === 0}
            variant="canvas"
            isOpen={isModalOpen}
            onClick={handleGoQuerylessClick}
          >
            <Trans i18nKey="alerting.rule-editor.go-queryless">Go queryless</Trans>
          </ToolbarButton>
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

export type PluginExtensionAlertingRuleContext = {
  targets: DataQuery[];
};

function useExtensionPointContext(props: Props): PluginExtensionAlertingRuleContext {
  const { query } = props;
  return {
    targets: [query],
  };
}
