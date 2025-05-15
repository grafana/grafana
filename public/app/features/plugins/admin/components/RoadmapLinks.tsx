import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Space, TextLink } from '@grafana/ui';

export const RoadmapLinks = () => {
  return (
    <div>
      <Space v={2} />
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
