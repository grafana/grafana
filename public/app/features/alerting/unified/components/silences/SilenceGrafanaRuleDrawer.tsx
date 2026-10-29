import React from 'react';

import { type Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Drawer, Stack } from '@grafana/ui';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { InstanceSilenceForm } from './InstanceSilenceForm';

type Props = {
  ruleUid: string;
  onClose: () => void;
  instanceLabels?: Labels;
  title?: string;
  subtitle?: string;
};

/**
 * For a given Grafana managed rule, renders a drawer containing silences editor and Alertmanager selection
 */
const SilenceGrafanaRuleDrawer = React.memo(({ ruleUid, onClose, instanceLabels, title, subtitle }: Props) => {
  const drawerTitle = title ?? t('alerting.silence-grafana-rule-drawer.title-silence-alert-rule', 'Silence alert rule');
  const drawerSubtitle =
    subtitle ??
    t(
      'alerting.silence-grafana-rule-drawer.subtitle',
      'Configure silences to stop notifications from a particular alert rule.'
    );

  return (
    <Drawer title={drawerTitle} subtitle={drawerSubtitle} onClose={onClose} size="md">
      <Stack direction={'column'}>
        {instanceLabels ? (
          <InstanceSilenceForm ruleUid={ruleUid} instanceLabels={instanceLabels} onClose={onClose} />
        ) : (
          <AlertmanagerProvider accessType="instance" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
            <SilencesEditor
              ruleUid={ruleUid}
              alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
              onSilenceCreated={onClose}
              onCancel={onClose}
            />
          </AlertmanagerProvider>
        )}
      </Stack>
    </Drawer>
  );
});
SilenceGrafanaRuleDrawer.displayName = 'SilenceGrafanaRuleDrawer';

export default SilenceGrafanaRuleDrawer;
