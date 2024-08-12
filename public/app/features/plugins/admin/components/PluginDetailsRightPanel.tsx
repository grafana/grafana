import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { TextLink, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { CatalogPlugin } from '../types';

type Props = {
  info: PageInfoItem[];
  plugin: CatalogPlugin;
};

export function PluginDetailsRightPanel(props: Props): React.ReactElement | null {
  const { info, plugin } = props;

  return (
    <Stack direction="column" gap={1} grow={0} shrink={0} maxWidth={'250px'}>
      {info.map((infoItem, index) => {
        return (
          <Stack key={index} wrap>
            <Text color="secondary">{infoItem.label + ':'}</Text>
            <div>{infoItem.value}</div>
          </Stack>
        );
      })}

      {plugin.updatedAt && (
        <div>
          <Text color="secondary">
            <Trans i18nKey="plugins.details.labels.updatedAt">Last updated: </Trans>
          </Text>{' '}
          <Text>{formatDate(new Date(plugin.updatedAt))}</Text>
        </div>
      )}

      {plugin?.details?.links && plugin.details?.links?.length > 0 && (
        <Stack direction="column" gap={2}>
          {plugin.details.links.map((link, index) => (
            <div key={index}>
              <TextLink href={link.url} external>
                {link.name}
              </TextLink>
            </div>
          ))}
        </Stack>
      )}

      {!plugin?.isCore && (
        <TextLink href="mailto:integrations@grafana.com" external>
          <Trans i18nKey="plugins.details.labels.reportAbuse">Report Abuse</Trans>
        </TextLink>
      )}
    </Stack>
  );
}
