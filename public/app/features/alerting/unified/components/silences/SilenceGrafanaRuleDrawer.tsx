import React from 'react';

import { Divider, Drawer, Stack } from '@grafana/ui';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';
import { GrafanaAlertmanagerDeliveryWarning } from 'app/features/alerting/unified/components/GrafanaAlertmanagerDeliveryWarning';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

type Props = {
  rulerRule: RulerGrafanaRuleDTO;
  onClose: () => void;
};

/**
 * For a given Grafana managed rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilenceGrafanaRuleDrawer = ({ rulerRule, onClose }: Props) => {
  const { uid } = rulerRule.grafana_alert;

  const formValues = getDefaultSilenceFormValues();
  const { selectedAlertmanager } = useAlertmanager();

  return (
    <Drawer
      title="Silence alert rule"
      subtitle="Configure silences to stop notifications from a particular alert rule."
      onClose={onClose}
      size="md"
    >
      <Stack direction={'column'}>
        <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager!} />

        <div>
          <AlertManagerPicker showOnlyReceivingGrafanaAlerts />
          <Divider />
        </div>

        <SilencesEditor
          ruleUid={uid}
          formValues={formValues}
          alertManagerSourceName={selectedAlertmanager!}
          onSilenceCreated={onClose}
          onCancel={onClose}
        />
      </Stack>
    </Drawer>
  );
};

export default SilenceGrafanaRuleDrawer;
