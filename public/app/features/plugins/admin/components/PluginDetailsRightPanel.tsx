import * as React from 'react';

import { config } from '@grafana/runtime';
import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { Stack, Text, LinkButton, Box, TextLink, Icon, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { getLatestCompatibleVersion } from '../helpers';
import { CatalogPlugin, PluginIconName } from '../types';

import { getStyles } from './PluginDetailsHeaderDependencies';

type Props = {
  info: PageInfoItem[];
  plugin: CatalogPlugin;
};

export function PluginDetailsRightPanel(props: Props): React.ReactElement | null {
  const { info, plugin } = props;
  const styles = useStyles2(getStyles);

  const pluginDependencies = plugin.details?.pluginDependencies;
  let grafanaDependency = plugin.details?.grafanaDependency;
  const useLatestCompatibleInfo = !plugin.isInstalled;
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  if (useLatestCompatibleInfo && latestCompatibleVersion?.grafanaDependency) {
    grafanaDependency = latestCompatibleVersion?.grafanaDependency;
  }

  if (!grafanaDependency) {
    grafanaDependency = 'unknown';
  }

  const hasDependencyInfo = grafanaDependency || (pluginDependencies && pluginDependencies.length);

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

      {hasDependencyInfo && (
        <Box padding={2} borderColor="medium" borderStyle="solid">
          <Stack direction="column" gap={1}>
            <Text color="secondary">
              <Trans i18nKey="plugins.details.labels.dependencies">Dependencies</Trans>
            </Text>
            <Stack direction="column" gap={1}>
              <span className={styles.depBadge}>
                <Icon name="grafana" className={styles.icon} />
                <Trans i18nKey="plugins.details.labels.grafanaDependency">Grafana </Trans> {grafanaDependency}
              </span>
            </Stack>

            {pluginDependencies && pluginDependencies.length > 0 && (
              <Stack direction="column" gap={1}>
                <Text color="secondary">
                  <Trans i18nKey={'plugins.details.labels.pluginDependencies'}>Plugins: </Trans>
                </Text>
                <Stack direction="column" gap={2}>
                  {pluginDependencies.map((p) => {
                    return (
                      <TextLink key={p.id} href={'/plugins/' + p.id}>
                        <Icon name={PluginIconName[p.type]} className={styles.icon} />
                        {p.name} {p.version}
                      </TextLink>
                    );
                  })}
                </Stack>
              </Stack>
            )}

            {config.pluginDependants && config.pluginDependants[plugin.id] && (
              <Stack direction="column" gap={1}>
                <Text color="secondary">
                  <Trans i18nKey={'plugins.details.labels.pluginDependants'}>Required by: </Trans>
                </Text>
                {config.pluginDependants[plugin.id].map((p) => {
                  return (
                    <TextLink key={p.pluginId} href={'/plugins/' + p.pluginId}>
                      <Icon name={PluginIconName[p.pluginType]} className={styles.icon} />
                      {p.pluginName} {p.pluginVersion}
                    </TextLink>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Box>
      )}

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
