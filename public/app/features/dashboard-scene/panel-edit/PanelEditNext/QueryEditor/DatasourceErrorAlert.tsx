import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { useDatasourceContext } from './QueryEditorContext';

export function DatasourceErrorAlert() {
  const { dsError } = useDatasourceContext();

  if (!dsError) {
    return null;
  }

  return (
    <Alert severity="error" title={t('query-editor-renderer.datasource-error-title', 'Datasource error')}>
      {dsError.message}
    </Alert>
  );
}
