import React from 'react';

import { Drawer, Stack } from '@grafana/ui';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

type Props = {
  rulerRule: RulerGrafanaRuleDTO;
  onClose: () => void;
};

/**
 * For a given Grafana managed rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilenceGrafanaRuleDrawer = React.memo(
  ({ rulerRule, onClose }: Props) => {
    const { uid } = rulerRule.grafana_alert;

    return (
      <Drawer
        title="Silence alert rule"
        subtitle="Configure silences to stop notifications from a particular alert rule."
        onClose={onClose}
        size="md"
      >
        <Stack direction={'column'}>
          <AlertmanagerProvider accessType="instance">
            <SilencesEditor
              ruleUid={uid}
              alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
              onSilenceCreated={onClose}
              onCancel={onClose}
            />
          </AlertmanagerProvider>
        </Stack>
      </Drawer>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.rulerRule.grafana_alert.uid === nextProps.rulerRule.grafana_alert.uid;
  }
);

export default SilenceGrafanaRuleDrawer;
