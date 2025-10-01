import { PanelProps } from '@grafana/data';
import { ScrollContainer, Stack } from '@grafana/ui';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaManagedAlerts } from './grafanaManaged';
import { AlertListPanelOptions } from './types';

function AlertListPanel(props: PanelProps<AlertListPanelOptions>) {
  const sources = props.options.datasource;

  // Check if Grafana is selected as a source
  const hasGrafanaSource = sources.some(
    (source) => source === GrafanaRulesSourceSymbol['description'] || source === 'grafana'
  );

  return (
    <ScrollContainer minHeight="100%">
      <Stack direction="column">
        {sources.length === 0 && <div>No alert sources configured</div>}
        {hasGrafanaSource && <GrafanaManagedAlerts />}
      </Stack>
    </ScrollContainer>
  );
}

export { AlertListPanel };
