import { PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { ScrollContainer, Stack } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { ExternalManagedAlerts } from './externalManaged';
import { GrafanaManagedAlerts } from './grafanaManaged';
import { AlertListPanelOptions } from './types';

function AlertListPanel(props: PanelProps<AlertListPanelOptions>) {
  const { datasource, stateFilter, alertInstanceLabelFilter, folder } = props.options;
  const { replaceVariables } = props;

  return (
    <ScrollContainer minHeight="100%">
      <Stack direction="column">
        {datasource.length === 0 && (
          <div>
            <Trans i18nKey="alertlist.panel.no-sources">No alert sources configured</Trans>
          </div>
        )}
        {datasource.map((source) =>
          source === GRAFANA_RULES_SOURCE_NAME ? (
            <GrafanaManagedAlerts
              key={source}
              stateFilter={stateFilter}
              alertInstanceLabelFilter={alertInstanceLabelFilter}
              folder={folder}
              replaceVariables={replaceVariables}
            />
          ) : (
            <ExternalManagedAlerts
              key={source}
              datasourceUID={source}
              stateFilter={stateFilter}
              alertInstanceLabelFilter={alertInstanceLabelFilter}
              replaceVariables={replaceVariables}
            />
          )
        )}
      </Stack>
    </ScrollContainer>
  );
}

export { AlertListPanel };
