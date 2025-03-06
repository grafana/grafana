import { PanelProps } from '@grafana/data';
import { ScrollContainer } from '@grafana/ui';
import { CentralAlertHistorySceneForPanel } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

import { AlertHistoryOptions } from './types';

export function AlertHistoryPanel(props: PanelProps<AlertHistoryOptions>) {
  if (!props) {
    // for some reason when editing the panel, props becomes undefined
    return <>No props</>;
  }
  return (
    <ScrollContainer minHeight="100%">
      <CentralAlertHistorySceneForPanel propsFromPanel={props} />
    </ScrollContainer>
  );
}
