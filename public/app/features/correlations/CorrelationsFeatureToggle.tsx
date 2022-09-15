import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

export default function FeatureTogglePage() {
  const styles = useStyles2(
    (theme: GrafanaTheme2) =>
      css`
        margin-top: ${theme.spacing(2)};
      `
  );

  return (
    <Page className={styles}>
      <Page.Contents>
        <h1>Correlations are disabled</h1>
        To enable Correlations, add it in the Grafana config:
        <div>
          <pre>
            {`[feature_toggles]
correlations = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}
