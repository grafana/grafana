import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { Stack, Text, LinkButton, Box, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import {
  getLatestCompatibleVersion,
  getPluginRepositoryUrl,
  fetchDefaultBranchFromRepo,
  getCustomLink,
} from '../helpers';
import { CatalogPlugin } from '../types';

type Props = {
  pluginExtentionsInfo: PageInfoItem[];
  plugin: CatalogPlugin;
  width?: string;
};

export function PluginDetailsPanel(props: Props): React.ReactElement | null {
  const { pluginExtentionsInfo, plugin, width = '250px' } = props;
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null);

  const trailURLSlash = (url: string | null) => (url?.endsWith('/') ? url?.slice(0, -1) : url);

  const repositoryLink = trailURLSlash(
    plugin.url ||
      (plugin.signatureType === 'community' && plugin.details?.links
        ? getPluginRepositoryUrl(plugin.details.links)
        : null)
  );

  useEffect(() => {
    if (repositoryLink) {
      fetchDefaultBranchFromRepo(repositoryLink)
        .then(setDefaultBranch)
        .catch(() => setDefaultBranch(null));
    }
  }, [repositoryLink]);

  const licenseLink = plugin.details?.links
    ? getCustomLink(plugin.details?.links, 'LICENSE', repositoryLink, defaultBranch)
    : null;
  const documentationLink = plugin.details?.links
    ? getCustomLink(plugin.details?.links, 'Documentation', repositoryLink, defaultBranch)
    : null;
  const customLinks = plugin.details?.links?.filter(
    (link) => ![repositoryLink, licenseLink, documentationLink].includes(trailURLSlash(link.url))
  );

  const shouldRenderLinks = Boolean(plugin.details?.links?.length || repositoryLink);

  return (
    <Stack direction="column" gap={3} shrink={0} grow={0} maxWidth={width} data-testid="plugin-details-panel">
      <Box padding={2} borderColor="medium" borderStyle="solid">
        <Stack direction="column" gap={2}>
          {pluginExtentionsInfo.map((infoItem, index) => {
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

      {shouldRenderLinks && (
        <Box padding={2} borderColor="medium" borderStyle="solid">
          <Stack direction="column" gap={2}>
            <Text color="secondary">
              <Trans i18nKey="plugins.details.labels.links">Links </Trans>
            </Text>
            {repositoryLink && (
              <LinkButton href={repositoryLink} variant="secondary" fill="solid">
                <Trans i18nKey="plugins.details.labels.repository">Repository</Trans>
              </LinkButton>
            )}

            {licenseLink && (
              <LinkButton href={licenseLink} variant="secondary" fill="solid">
                <Trans i18nKey="plugins.details.labels.license">License</Trans>
              </LinkButton>
            )}
            {documentationLink && (
              <LinkButton href={documentationLink} variant="secondary" fill="solid">
                <Trans i18nKey="plugins.details.labels.documentation">Documentation</Trans>
              </LinkButton>
            )}
            {repositoryLink && (
              <LinkButton href={`${repositoryLink}/issues/new`} variant="secondary" fill="solid">
                <Trans i18nKey="plugins.details.labels.raiseAnIssue">Raise an issue</Trans>
              </LinkButton>
            )}
            {customLinks &&
              customLinks.map((link, index) => (
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
