import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { Stack, Text, LinkButton, Box, TextLink, CollapsableSection, Tooltip, Icon, Modal, Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { getPluginRepositoryUrl, fetchDefaultBranchFromRepo, getCustomLink } from '../helpers';
import { CatalogPlugin } from '../types';

type Props = {
  pluginExtentionsInfo: PageInfoItem[];
  plugin: CatalogPlugin;
  width?: string;
};

export function PluginDetailsPanel(props: Props): React.ReactElement | null {
  const { pluginExtentionsInfo, plugin, width = '250px' } = props;
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null);
  const [reportAbuseModalOpen, setReportAbuseModalOpen] = useState(false);

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
    <>
      <Stack direction="column" gap={3} shrink={0} grow={0} minWidth={width} data-testid="plugin-details-panel">
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
                <Text>
                  {formatDate(new Date(plugin.updatedAt), { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
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
          <>
            <Box padding={2} borderColor="medium" borderStyle="solid">
              <Stack direction="column" gap={2}>
                <Text color="secondary">
                  <Trans i18nKey="plugins.details.labels.links">Links </Trans>
                </Text>
                {repositoryLink && (
                  <LinkButton href={repositoryLink} variant="secondary" fill="solid" icon="github">
                    <Trans i18nKey="plugins.details.labels.repository">Repository</Trans>
                  </LinkButton>
                )}
                {repositoryLink && (
                  <LinkButton href={`${repositoryLink}/issues/new`} variant="secondary" fill="solid" icon="github">
                    <Trans i18nKey="plugins.details.labels.raiseAnIssue">Raise an issue</Trans>
                  </LinkButton>
                )}
                {licenseLink && (
                  <LinkButton href={licenseLink} variant="secondary" fill="solid" icon={'document-info'}>
                    <Trans i18nKey="plugins.details.labels.license">License</Trans>
                  </LinkButton>
                )}
                {documentationLink && (
                  <LinkButton href={documentationLink} variant="secondary" fill="solid" icon={'list-ui-alt'}>
                    <Trans i18nKey="plugins.details.labels.documentation">Documentation</Trans>
                  </LinkButton>
                )}
              </Stack>
            </Box>

            {customLinks && customLinks?.length > 0 && (
              <Box padding={2} borderColor="medium" borderStyle="solid">
                <CollapsableSection
                  isOpen={false}
                  label={
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Text color="secondary" variant="body">
                        <Trans i18nKey="plugins.details.labels.customLinks">Custom links </Trans>
                      </Text>
                      <Tooltip
                        content={
                          'These links are provided by the plugin developer to offer additional, developer-specific resources and information'
                        }
                        placement="right-end"
                      >
                        <Icon name="info-circle" size="xs" />
                      </Tooltip>
                    </Stack>
                  }
                >
                  <Stack direction="column" gap={2}>
                    {customLinks.map((link, index) => (
                      <TextLink key={index} href={link.url} external>
                        {link.name}
                      </TextLink>
                    ))}
                  </Stack>
                </CollapsableSection>
              </Box>
            )}
          </>
        )}
        {!plugin?.isCore && (
          <Box padding={2} borderColor="medium" borderStyle="solid">
            <CollapsableSection
              isOpen={false}
              label={
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Text color="secondary" variant="body">
                    <Trans i18nKey="plugins.details.labels.reportAbuse">Report a concern </Trans>
                  </Text>
                  <Tooltip
                    content={'Report issues related to malicious or harmful plugins directly to Grafana Labs.'}
                    placement="right-end"
                  >
                    <Icon name="info-circle" size="xs" />
                  </Tooltip>
                </Stack>
              }
            >
              <Stack direction="column">
                <Button variant="secondary" fill="solid" icon="bell" onClick={() => setReportAbuseModalOpen(true)}>
                  <Trans i18nKey="plugins.details.labels.contactGrafanaLabs">Contact Grafana Labs</Trans>
                </Button>
              </Stack>
            </CollapsableSection>
          </Box>
        )}
      </Stack>
      {reportAbuseModalOpen && (
        <Modal title="Report a plugin concern" isOpen onDismiss={() => setReportAbuseModalOpen(false)}>
          <Stack direction="column" gap={2}>
            <Text>
              <Trans i18nKey="plugins.details.modal.description">
                This feature is for reporting malicious or harmful behaviour within plugins. For plugin concerns, email
                us at: <TextLink href="mailto:integrations@grafana.com">integrations@grafana.com</TextLink>.{' '}
              </Trans>
            </Text>
            <Text>
              <Trans i18nKey="plugins.details.modal.node">
                Note: For general plugin issues like bugs or feature requests, please contact the plugin author using
                the provided links.{' '}
              </Trans>
            </Text>
          </Stack>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={() => setReportAbuseModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="copy" onClick={() => navigator.clipboard.writeText('integrations@grafana.com')}>
              Copy email address
            </Button>
          </Modal.ButtonRow>
        </Modal>
      )}
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    pluginVersionDetails: css({
      wordBreak: 'break-word',
    }),
  };
};
