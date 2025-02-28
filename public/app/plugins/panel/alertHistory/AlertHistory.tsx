import { PanelProps } from '@grafana/data';
import { ScrollContainer, Text } from '@grafana/ui';
import { CentralAlertHistorySceneWithNoUrlSync } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

import { AlertHistoryOptions } from './types';

export function AlertHistoryPanel(props: PanelProps<AlertHistoryOptions>) {
  if (!props) {
    // for some reason when editing the panel, props becomes undefined
    return <>No props</>;
  }
  if (props?.options?.hideEventsGraph && props?.options?.hideEventsList) {
    return <Text>No content to show</Text>;
  }
  return (
    <ScrollContainer minHeight="100%">
      <CentralAlertHistorySceneWithNoUrlSync propsFromPanel={props} />
    </ScrollContainer>
  );
}
