import { PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { ScrollContainer, Stack } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { ExternalManagedAlerts } from './externalManaged';
import { GrafanaManagedAlerts } from './grafanaManaged';
import { AlertListPanelOptions } from './types';

function AlertListPanel(props: PanelProps<AlertListPanelOptions>) {
  const sources = props.options.datasource;

  return (
    <ScrollContainer minHeight="100%">
      <Stack direction="column">
        {sources.length === 0 && (
          <div>
            <Trans i18nKey="alertlist.panel.no-sources">No alert sources configured</Trans>
          </div>
        )}
        {sources.map((source) =>
          source === GRAFANA_RULES_SOURCE_NAME ? (
            <GrafanaManagedAlerts key={source} />
          ) : (
            <ExternalManagedAlerts key={source} datasourceUID={source} />
          )
        )}
      </Stack>
    </ScrollContainer>
  );
}

export { AlertListPanel };
