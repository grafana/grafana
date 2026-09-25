import React from 'react';

import { t } from '@grafana/i18n';
import { Drawer, Stack } from '@grafana/ui';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { type RuleReference } from 'app/features/alerting/unified/types/silence-form';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

type Props = {
  rule: RuleReference;
  onClose: () => void;
};

/**
 * For a given Grafana managed rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilenceGrafanaRuleDrawer = React.memo(
  ({ rule, onClose }: Props) => (
    <Drawer
      title={t('alerting.silence-grafana-rule-drawer.title-silence-alert-rule', 'Silence alert rule')}
      subtitle="Configure silences to stop notifications from a particular alert rule."
      onClose={onClose}
      size="md"
    >
      <Stack direction={'column'}>
        <AlertmanagerProvider accessType="instance">
          <SilencesEditor
            rule={rule}
            alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
            onSilenceCreated={onClose}
            onCancel={onClose}
          />
        </AlertmanagerProvider>
      </Stack>
    </Drawer>
  ),
  (prevProps, nextProps) => prevProps.rule.uid === nextProps.rule.uid
);
SilenceGrafanaRuleDrawer.displayName = 'SilenceGrafanaRuleDrawer';

export default SilenceGrafanaRuleDrawer;
