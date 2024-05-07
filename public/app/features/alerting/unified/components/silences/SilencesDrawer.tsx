import React from 'react';

import { Drawer, Stack } from '@grafana/ui';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';
import { GrafanaAlertmanagerDeliveryWarning } from 'app/features/alerting/unified/components/GrafanaAlertmanagerDeliveryWarning';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { isGrafanaRulerRule } from 'app/features/alerting/unified/utils/rules';
import { CombinedRule } from 'app/types/unified-alerting';

type Props = {
  rule: CombinedRule;
  onClose: () => void;
};

/**
 * For a given rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilencesDrawer = ({ rule, onClose }: Props) => {
  const ruleUid = isGrafanaRulerRule(rule.rulerRule) ? rule.rulerRule?.grafana_alert.uid : '';

  const formValues = getDefaultSilenceFormValues();
  const { selectedAlertmanager } = useAlertmanager();

  return (
    <Drawer
      title="Silence alert rule"
      subtitle="Configure silences to stop notifications from a particular alert rule."
      onClose={onClose}
      size="md"
    >
      <Stack gap={2} direction={'column'}>
        <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager!} />

        <AlertManagerPicker showOnlyReceving />

        <SilencesEditor
          ruleUid={ruleUid}
          formValues={formValues}
          alertManagerSourceName={selectedAlertmanager!}
          onSilenceCreated={onClose}
          onCancel={onClose}
        />
      </Stack>
    </Drawer>
  );
};

export default SilencesDrawer;
