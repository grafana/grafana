import { Drawer, Stack } from '@grafana/ui';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
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

  return (
    <Drawer
      title="Silence alert rule"
      subtitle="Configure silences to stop notifications from a particular alert rule."
      onClose={onClose}
      size="md"
    >
      <Stack direction={'column'}>
        <SilencesEditor
          ruleUid={uid}
          formValues={formValues}
          alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          onSilenceCreated={onClose}
          onCancel={onClose}
        />
      </Stack>
    </Drawer>
  );
};

export default SilenceGrafanaRuleDrawer;
