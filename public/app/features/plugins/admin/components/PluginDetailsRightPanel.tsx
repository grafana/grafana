import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { Stack, Text, LinkButton, Box, TextLink } from '@grafana/ui';
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
    <Stack direction="column" gap={3} shrink={0} grow={0} maxWidth={'250px'}>
      <Box padding={2} borderColor="medium" borderStyle="solid">
        <Stack direction="column" gap={2}>
          {info.map((infoItem, index) => {
            return (
              <Stack key={index} wrap direction="column" gap={0.5}>
                <Text color="secondary">{infoItem.label + ':'}</Text>
                <div>{infoItem.value}</div>
              </Stack>
            );
          })}
          {plugin.updatedAt && (
            <Stack direction="column" gap={0.5}>
              <Text color="secondary">
                <Trans i18nKey="plugins.details.labels.updatedAt">Last updated: </Trans>
              </Text>{' '}
              <Text>{formatDate(new Date(plugin.updatedAt))}</Text>
            </Stack>
          )}
        </Stack>
      </Box>

      {plugin?.details?.links && plugin.details?.links?.length > 0 && (
        <Box padding={2} borderColor="medium" borderStyle="solid">
          <Stack direction="column" gap={2}>
            <Text color="secondary">
              <Trans i18nKey="plugins.details.labels.links">Links </Trans>
            </Text>
            {plugin.details.links.map((link, index) => (
              <TextLink key={index} href={link.url} external>
                {link.name}
              </TextLink>
            ))}
          </Stack>
        </Box>
      )}

      {!plugin?.isCore && (
        <Box padding={2} borderColor="medium" borderStyle="solid">
          <Stack direction="column">
            <Text color="secondary">
              <Trans i18nKey="plugins.details.labels.reportAbuse">Report a concern </Trans>
            </Text>
            <LinkButton href="mailto:integrations@grafana.com" variant="secondary" fill="solid">
              <Trans i18nKey="plugins.details.labels.contactGrafanaLabs">Contact Grafana Labs</Trans>
            </LinkButton>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
