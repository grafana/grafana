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
    <Stack direction="column" gap={2} grow={3}>
      {info.map((infoItem, index) => {
        return (
          <Stack key={index}>
            <Trans i18nKey="plugins.details.labels.info">
              <Text color="secondary">{infoItem.label}: </Text>
            </Trans>
            <div>{infoItem.value}</div>
          </Stack>
        );
      })}

      <div>
        <Trans i18nKey="plugins.details.labels.updatedAt">
          <Text color="secondary">Last updated: </Text>{' '}
        </Trans>
        <Text>{formatDate(new Date(plugin.updatedAt))}</Text>
      </div>

      {plugin?.details?.links && plugin.details?.links?.length > 0 && (
        <Stack direction="column" gap={2}>
          {plugin.details.links.map((link, index) => (
            <div key={index}>
              <Trans i18nKey="plugins.details.labels.links">
                <TextLink href={link.url} external>
                  {link.name}
                </TextLink>
              </Trans>
            </div>
          ))}
        </Stack>
      )}

      <Trans i18nKey="plugins.details.labels.reportAbuse">
        <TextLink href="mailto:integrations@grafana.com" external>
          Report Abuse
        </TextLink>
      </Trans>
    </Stack>
  );
}
