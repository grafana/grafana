import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export type MoveResultFailed = {
  status?: 'failed';
  title?: string;
  errorMessage?: string;
};

export function BulkActionFailureBanner({ result, onDismiss }: { result: MoveResultFailed[]; onDismiss: () => void }) {
  return (
    <Alert
      severity="error"
      title={t('browse-dashboards.bulk-action-resources-form.failed-alert', '{{count}} {{item}} failed', {
        count: result.length,
        item: result.length === 1 ? 'item' : 'items',
      })}
      onRemove={onDismiss}
    >
      <ul>
        {result.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            {item.errorMessage && `: ${item.errorMessage}`}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
