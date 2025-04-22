import { css } from '@emotion/css';
import { ErrorInfo, useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, locationUtil, PageLayoutType } from '@grafana/data';
import { Button, ErrorWithStack, useStyles2 } from '@grafana/ui';

import { Page } from '../components/Page/Page';
import { t, Trans } from '../internationalization';

interface Props {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export function GrafanaRouteError({ error, errorInfo }: Props) {
  const location = useLocation();
  const isChunkLoadingError = error?.name === 'ChunkLoadError';
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Auto reload page 1 time if we have a chunk load error
    if (isChunkLoadingError && location.search.indexOf('chunkNotFound') === -1) {
      window.location.href = locationUtil.getUrlForPartial(location, { chunkNotFound: true });
    }
  }, [location, isChunkLoadingError]);

  // Would be good to know the page navId here but needs a pretty big refactoring

  return (
    <Page navId="error" layout={PageLayoutType.Canvas}>
      <div className={styles.container}>
        {isChunkLoadingError && (
          <div>
            <h2>
              <Trans i18nKey="route-error.title">Unable to find application file</Trans>
            </h2>
            <br />
            <h2 className="page-heading">
              <Trans i18nKey="route-error.description">
                Grafana has likely been updated. Please try reloading the page.
              </Trans>
            </h2>
            <br />
            <Button size="md" variant="secondary" icon="repeat" onClick={() => window.location.reload()}>
              <Trans i18nKey="route-error.reload-button">Reload</Trans>
            </Button>
            <ErrorWithStack title={t('route-error.error-title', 'Error details')} error={error} errorInfo={errorInfo} />
          </div>
        )}
        {!isChunkLoadingError && (
          <ErrorWithStack
            title={t('route-error.error-unexpected-title', 'An unexpected error happened')}
            error={error}
            errorInfo={errorInfo}
          />
        )}
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '500px',
    margin: theme.spacing(8, 'auto'),
  }),
});
