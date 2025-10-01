import { PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { ExternalManagedAlerts } from './externalManaged';
import { GrafanaManagedAlerts } from './grafanaManaged';
import { AlertListPanelOptions } from './types';

function AlertListPanel(props: PanelProps<AlertListPanelOptions>) {
  const { datasource, stateFilter, alertInstanceLabelFilter, folder } = props.options;
  const { replaceVariables } = props;

  if (datasource.length === 0) {
    return (
      <div>
        <Trans i18nKey="alertlist.panel.no-sources">No alert sources configured</Trans>
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}

export { AlertListPanel };
