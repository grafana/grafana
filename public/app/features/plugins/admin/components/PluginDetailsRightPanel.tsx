import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { Stack, Text, LinkButton, Box, TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { getLatestCompatibleVersion } from '../helpers';
import { CatalogPlugin } from '../types';

type Props = {
  info: PageInfoItem[];
  plugin: CatalogPlugin;
};

export function PluginDetailsRightPanel(props: Props): React.ReactElement | null {
  const { info, plugin } = props;
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" gap={3} shrink={0} grow={0} maxWidth={'250px'}>
      <Box padding={2} borderColor="medium" borderStyle="solid">
        <Stack direction="column" gap={2}>
          {plugin.isInstalled && plugin.installedVersion && (
            <Stack wrap direction="column" gap={0.5}>
              <Text color="secondary">
                <Trans i18nKey="plugins.details.labels.installedVersion">Installed version: </Trans>
              </Text>
              <div className={styles.pluginVersionDetails}>{plugin.installedVersion}</div>
            </Stack>
          )}
          {info.map((infoItem, index) => {
            if (infoItem.label === 'Version') {
              return (
                <Stack key={index} wrap direction="column" gap={0.5}>
                  <Text color="secondary">
                    <Trans i18nKey="plugins.details.labels.latestVersion">Latest version: </Trans>
                  </Text>
                  <div className={styles.pluginVersionDetails}>
                    {getLatestCompatibleVersion(plugin.details?.versions)?.version}
                  </div>
                </Stack>
              );
            }
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
                <Trans i18nKey="plugins.details.labels.updatedAt">Last updated:</Trans>
              </Text>{' '}
              <Text>{formatDate(new Date(plugin.updatedAt), { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </Stack>
          )}
          {plugin?.details?.lastCommitDate && (
            <Stack direction="column" gap={0.5}>
              <Text color="secondary">
                <Trans i18nKey="plugins.details.labels.lastCommitDate">Last commit date:</Trans>
              </Text>{' '}
              <Text>
                {formatDate(new Date(plugin.details.lastCommitDate), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
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

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    pluginVersionDetails: css({
      wordBreak: 'break-word',
    }),
  };
};
