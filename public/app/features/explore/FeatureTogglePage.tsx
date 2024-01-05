import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

function getStyles(theme: GrafanaTheme2) {
  return css({
    marginTop: theme.spacing(2),
  });
}

export default function FeatureTogglePage() {
  const styles = useStyles2(getStyles);

  return (
    <Page className={styles}>
      <Page.Contents>
        <h1>Explore is disabled</h1>
        To enable Explore, enable it in the Grafana config:
        <div>
          <pre>
            {`[explore]
enable = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}
