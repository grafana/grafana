import { css } from '@emotion/css';
import React, { ErrorInfo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, locationUtil, PageLayoutType } from '@grafana/data';
import { Button, ErrorWithStack, useStyles2 } from '@grafana/ui';

import { Page } from '../components/Page/Page';

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
            <h2>Unable to find application file</h2>
            <br />
            <h2 className="page-heading">Grafana has likely been updated. Please try reloading the page.</h2>
            <br />
            <Button size="md" variant="secondary" icon="repeat" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <ErrorWithStack title={'Error details'} error={error} errorInfo={errorInfo} />
          </div>
        )}
        {!isChunkLoadingError && (
          <ErrorWithStack title={'An unexpected error happened'} error={error} errorInfo={errorInfo} />
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
