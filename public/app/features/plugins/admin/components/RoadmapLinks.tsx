import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css({
    height: theme.spacing(2),
  }),
});

export const RoadmapLinks = () => {
  const styles = useStyles2(getStyles);
  return (
    <div>
      <div className={styles.spacer} />
      <TextLink
        href="https://github.com/grafana/grafana/issues/new?assignees=&labels=area%2Fdatasource%2Ctype%2Fnew-plugin-request&projects=&template=3-data_source_request.yaml&title=%5BNew+Data+Source%5D%3A+%3Cname-of-service%3E"
        onClick={() => reportInteraction('connections_data_source_request_clicked')}
        external
      >
        <Trans i18nKey="connections.connect-data.request-data-source">Request a new data source</Trans>
      </TextLink>
      <br />
      <TextLink
        href="https://github.com/orgs/grafana/projects/619/views/1?pane=info"
        onClick={() => reportInteraction('connections_data_source_roadmap_clicked')}
        external
      >
        <Trans i18nKey="connections.connect-data.roadmap">View roadmap</Trans>
      </TextLink>
    </div>
  );
};
