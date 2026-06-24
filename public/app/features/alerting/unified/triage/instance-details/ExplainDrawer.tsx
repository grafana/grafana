import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Drawer, LoadingPlaceholder, Stack, Text, TextLink } from '@grafana/ui';
import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { generateAlertDescriptionForGrafanaRule } from '../../utils/alert-annotations';
import { useWorkbenchContext } from '../WorkbenchContext';

function calculateDrawerWidth(rightColumnWidth: number): number {
  const calculatedWidth = rightColumnWidth + 32;
  return Math.max(700, Math.min(calculatedWidth, 1400));
}

interface ExplainDrawerProps {
  rule: RulerGrafanaRuleDTO;
  onClose: () => void;
}

export function ExplainDrawer({ rule, onClose }: ExplainDrawerProps) {
  const { rightColumnWidth } = useWorkbenchContext();
  const drawerWidth = calculateDrawerWidth(rightColumnWidth);

  const description = useMemo(() => generateAlertDescriptionForGrafanaRule(rule), [rule]);
  const ruleTitle = rule.grafana_alert.title;

  return (
    <Drawer
      title={t('alerting.triage.explain.drawer-title', 'Explain: {{ruleTitle}}', { ruleTitle })}
      subtitle={t(
        'alerting.triage.explain.drawer-subtitle',
        'A plain-language summary of what this alert rule monitors and when it fires'
      )}
      onClose={onClose}
      width={drawerWidth}
    >
      <Stack direction="column" gap={2}>
        <Text>{description}</Text>
        <TextLink
          href="#"
          onClick={(event) => {
            event.preventDefault();
          }}
        >
          <Trans i18nKey="alerting.triage.explain.ai-assistant-link">Explain further with AI Assistant</Trans>
        </TextLink>
      </Stack>
    </Drawer>
  );
}

export function ExplainDrawerLoading({ onClose }: { onClose: () => void }) {
  const { rightColumnWidth } = useWorkbenchContext();
  const drawerWidth = calculateDrawerWidth(rightColumnWidth);

  return (
    <Drawer title={t('alerting.triage.explain.drawer-title-loading', 'Explain')} onClose={onClose} width={drawerWidth}>
      <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />
    </Drawer>
  );
}
