import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
        <h1>
          <Trans i18nKey="explore.feature-toggle-page.title-explore-disabled">Explore is disabled</Trans>
        </h1>
        <Trans i18nKey="explore.feature-toggle-page.description-explore-disabled">
          To enable Explore, enable it in the Grafana config:
        </Trans>
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
