import React from 'react';

import { t } from '@grafana/i18n';
import { Drawer, Stack } from '@grafana/ui';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

type Props = {
  ruleUid: string;
  onClose: () => void;
};

/**
 * For a given Grafana managed rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilenceGrafanaRuleDrawer = React.memo(
  ({ ruleUid, onClose }: Props) => (
    <Drawer
      title={t('alerting.silence-grafana-rule-drawer.title-silence-alert-rule', 'Silence alert rule')}
      subtitle="Configure silences to stop notifications from a particular alert rule."
      onClose={onClose}
      size="md"
    >
      <Stack direction={'column'}>
        <AlertmanagerProvider accessType="instance">
          <SilencesEditor
            ruleUid={ruleUid}
            alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
            onSilenceCreated={onClose}
            onCancel={onClose}
          />
        </AlertmanagerProvider>
      </Stack>
    </Drawer>
  ),
  (prevProps, nextProps) => prevProps.ruleUid === nextProps.ruleUid
);

export default SilenceGrafanaRuleDrawer;
