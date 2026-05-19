import { Trans, t } from '@grafana/i18n';

import { NeedHelpInfo } from '../rule-editor/NeedHelpInfo';

/**
 * Shared help for the imported notification policy tree name (step 1 + review).
 * Explains that Grafana creates a separate policy tree and how the name is used when importing rules.
 */
export function PolicyTreeNameHelp() {
  return (
    <NeedHelpInfo
      title={t('alerting.import-to-gma.step1.policy-tree-help-title', 'About policy tree names')}
      contentText={
        <Trans i18nKey="alerting.import-to-gma.step1.policy-tree-help">
          When you import this Alertmanager configuration, Grafana will create a separate notification policy tree for
          it. The name you enter here will identify that tree in the UI and is what you select when you import alert
          rules that should use this routing. Use a label you will recognize — for example data source, team, cluster,
          or environment (such as prometheus-prod or platform-team).
        </Trans>
      }
    />
  );
}
