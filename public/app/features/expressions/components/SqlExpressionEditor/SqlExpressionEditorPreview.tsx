import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Stack, Alert, Text, Box } from '@grafana/ui';

import { ExpressionQuery } from '../../types';

interface SqlExpressionEditorPreviewProps {
  query: ExpressionQuery;
  previewError: string | null;
  hasExecutedSuccessfully: boolean;
}

export const SqlExpressionEditorPreview = ({
  hasExecutedSuccessfully,
  previewError,
  query,
}: SqlExpressionEditorPreviewProps) => {
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleRunPreview = useCallback(() => {
    setIsPreviewLoading(true);
    // TODO: Implement preview
  }, []);

  const buttonLabel = isPreviewLoading
    ? t('expressions.sql-drawer.testing-query', 'Testing...')
    : t('expressions.sql-drawer.test-query', 'Test query');

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Text variant="h5">{t('expressions.sql-drawer.query-validation', 'Query validation')}</Text>
        <Button
          style={{ flexShrink: 1 }}
          size="sm"
          fill="outline"
          variant="secondary"
          onClick={handleRunPreview}
          icon={isPreviewLoading ? 'spinner' : 'sync'}
          disabled={isPreviewLoading}
        >
          {buttonLabel}
        </Button>
      </Stack>

      <Box backgroundColor="secondary" height="fit-content" width="100%" padding={2}>
        {isPreviewLoading ? (
          <Alert title={t('expressions.sql-drawer.testing', 'Testing Query')} severity="info">
            {t('expressions.sql-drawer.testing-description', 'Checking if your SQL query is valid...')}
          </Alert>
        ) : previewError ? (
          <Alert title={t('expressions.sql-drawer.query-error', 'Query Error')} severity="error">
            {previewError}
          </Alert>
        ) : hasExecutedSuccessfully ? (
          <Alert title={t('expressions.sql-drawer.query-valid', 'Query Valid')} severity="success">
            {t(
              'expressions.sql-drawer.query-valid-description',
              'Your SQL query executed successfully! The results will appear in your panel visualization.'
            )}
          </Alert>
        ) : query.expression ? (
          <Text variant="bodySmall" color="maxContrast">
            {t('expressions.sql-drawer.ready-to-test', 'Ready to test your SQL query')}
          </Text>
        ) : (
          <Text variant="bodySmall" color="maxContrast">
            {t('expressions.sql-drawer.write-sql-first', 'Write your SQL query above, then test it')}
          </Text>
        )}
      </Box>
    </>
  );
};
