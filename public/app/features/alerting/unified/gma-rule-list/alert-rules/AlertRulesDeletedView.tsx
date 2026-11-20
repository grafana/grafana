import { t } from '@grafana/i18n';

import { DeletedRulesView } from '../deleted-rules/DeletedRulesView';
import { useRestoreAlertRule } from '../deleted-rules/useRestoreRule';

import { useDeletedAlertRules } from './useDeletedAlertRules';

export function AlertRulesDeletedView() {
  const list = useDeletedAlertRules();
  const restorer = useRestoreAlertRule();

  return (
    <DeletedRulesView
      kind="alert"
      list={list}
      restorer={restorer}
      restoreTitle={t('alerting.recently-deleted.restore.title', 'Restore alert rule')}
    />
  );
}
