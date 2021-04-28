import React, { FunctionComponent } from 'react';
import { Button, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { useUrlParams } from 'app/core/navigation/hooks';

const getStyles = stylesFactory(() => {
  return css`
    width: 508px;
    margin: 128px auto;
  `;
});

interface Props {
  error: Error | null;
}

export const ErrorLoadingChunk: FunctionComponent<Props> = ({ error }) => {
  const [params, updateUrlParams] = useUrlParams();

  if (!params.get('chunkNotFound')) {
    updateUrlParams({ chunkNotFound: true }, true);
    window.location.reload();
  }

  return (
    <div className={getStyles()}>
      <h2>Unable to find application file</h2>
      <br />
      <h2 className="page-heading">Grafana has likely been updated. Please try reloading the page.</h2>
      <br />
      <div className="gf-form-group">
        <Button size="md" variant="secondary" icon="repeat" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        {error && error.message ? error.message : 'Unexpected error occurred'}
        <br />
        {error && error.stack ? error.stack : null}
      </details>
    </div>
  );
};

ErrorLoadingChunk.displayName = 'ErrorLoadingChunk';
