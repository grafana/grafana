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
      title={t('browse-dashboards.bulk-action-resources-form.failed-alert', '{{count}} items failed', {
        count: result.length,
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
