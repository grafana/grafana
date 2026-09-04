import { type DataQueryError } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

export interface ErrorContainerProps {
  queryError?: DataQueryError;
}

export const ErrorContainer = (props: ErrorContainerProps) => {
  const { queryError } = props;
  const showError = queryError ? true : false;
  const duration = showError ? 100 : 10;
  const title = queryError
    ? t('explore.error-container.title-query-error', 'Query error')
    : t('explore.error-container.title-unknown-error', 'Unknown error');
  const message = queryError?.message || queryError?.data?.message || null;

  return (
    <FadeIn in={showError} duration={duration}>
      <Alert severity="error" title={title} topSpacing={2}>
        {message}
      </Alert>
    </FadeIn>
  );
};
