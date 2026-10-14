import { t } from '@grafana/i18n';

/** Display name of a manager kind other than the classic provisioning ones; unknown kinds show as they are. */
export function managerKindName(kind: string): string {
  switch (kind) {
    case 'terraform':
      return 'Terraform';
    case 'kubectl':
      return 'kubectl';
    case 'repo':
      return t('alerting.rule-actions.manager-git-sync', 'Git sync');
    case 'classic-converted-prometheus':
      return t('alerting.rule-actions.manager-prometheus-import', 'Prometheus import');
    default:
      return kind;
  }
}
