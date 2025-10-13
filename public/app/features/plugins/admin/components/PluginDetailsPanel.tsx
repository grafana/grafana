import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import {
  Stack,
  Text,
  LinkButton,
  Box,
  TextLink,
  CollapsableSection,
  Tooltip,
  Icon,
  Modal,
  Button,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { CatalogPlugin } from '../types';

type Props = {
  pluginExtentionsInfo: PageInfoItem[];
  plugin: CatalogPlugin;
  width?: string;
};

export function PluginDetailsPanel(props: Props): React.ReactElement | null {
  const { pluginExtentionsInfo, plugin, width = '250px' } = props;
  const [reportAbuseModalOpen, setReportAbuseModalOpen] = useState(false);

  const normalizeURL = (url: string | undefined) => url?.replace(/\/$/, '');

  const customLinks = plugin.details?.links?.filter((link) => {
    const customLinksFiltered = ![plugin.url, plugin.details?.licenseUrl, plugin.details?.documentationUrl]
      .map(normalizeURL)
      .includes(normalizeURL(link.url));
    return customLinksFiltered;
  });
  const shouldRenderLinks = plugin.url || plugin.details?.licenseUrl || plugin.details?.documentationUrl;

  const styles = useStyles2(getStyles);

  const onClickReportConcern = (pluginId: string) => {
    setReportAbuseModalOpen(true);
    reportInteraction('plugin_detail_report_concern', {
      plugin_id: pluginId,
    });
  };

  return (
    <>
      <Stack direction="column" gap={3} shrink={0} grow={0} width={width} data-testid="plugin-details-panel">
        <Box padding={2} borderColor="medium" borderStyle="solid">
          <Stack direction="column" gap={2}>
            {pluginExtentionsInfo.map((infoItem, index) => {
              return (
                <Stack key={index} wrap direction="column" gap={0.5}>
                  <Text color="secondary">{infoItem.label + ':'}</Text>
                  <div className={styles.pluginVersionDetails}>{infoItem.value}</div>
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
                {plugin.url && (
                  <LinkButton href={plugin.url} variant="secondary" fill="solid" icon="code-branch" target="_blank">
                    <Trans i18nKey="plugins.details.labels.repository">Repository</Trans>
                  </LinkButton>
                )}
                {plugin.raiseAnIssueUrl && (
                  <LinkButton href={plugin.raiseAnIssueUrl} variant="secondary" fill="solid" icon="bug" target="_blank">
                    <Trans i18nKey="plugins.details.labels.raiseAnIssue">Raise an issue</Trans>
                  </LinkButton>
                )}
                {plugin.details?.licenseUrl && (
                  <LinkButton
                    href={plugin.details?.licenseUrl}
                    variant="secondary"
                    fill="solid"
                    icon={'document-info'}
                    target="_blank"
                  >
                    <Trans i18nKey="plugins.details.labels.license">License</Trans>
                  </LinkButton>
                )}
                {plugin.details?.documentationUrl && (
                  <LinkButton
                    href={plugin.details?.documentationUrl}
                    variant="secondary"
                    fill="solid"
                    icon={'list-ui-alt'}
                    target="_blank"
                  >
                    <Trans i18nKey="plugins.details.labels.documentation">Documentation</Trans>
                  </LinkButton>
                )}
              </Stack>
            </Box>
          </>
        )}
        {customLinks && customLinks?.length > 0 && (
          <Box padding={2} borderColor="medium" borderStyle="solid">
            <CollapsableSection
              isOpen={true}
              label={
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Text color="secondary" variant="body">
                    <Trans i18nKey="plugins.details.labels.customLinks">Custom links </Trans>
                  </Text>
                  <Tooltip
                    content={
                      <Trans i18nKey="plugins.details.labels.customLinksTooltip">
                        These links are provided by the plugin developer to offer additional, developer-specific
                        resources and information
                      </Trans>
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
        {!plugin?.isCore && (
          <Box padding={2} borderColor="medium" borderStyle="solid">
            <CollapsableSection
              headerDataTestId="reportConcern"
              isOpen={false}
              label={
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Text color="secondary" variant="body">
                    <Trans i18nKey="plugins.details.labels.reportAbuse">Report a concern </Trans>
                  </Text>
                  <Tooltip
                    content={
                      <Trans i18nKey="plugins.details.labels.reportAbuseTooltip">
                        Report issues related to malicious or harmful plugins directly to Grafana Labs.
                      </Trans>
                    }
                    placement="right-end"
                  >
                    <Icon name="info-circle" size="xs" />
                  </Tooltip>
                </Stack>
              }
            >
              <Stack direction="column">
                <Button variant="secondary" fill="solid" icon="bell" onClick={() => onClickReportConcern(plugin.id)}>
                  <Trans i18nKey="plugins.details.labels.contactGrafanaLabs">Contact Grafana Labs</Trans>
                </Button>
              </Stack>
            </CollapsableSection>
          </Box>
        )}
      </Stack>
      {reportAbuseModalOpen && (
        <Modal
          title={<Trans i18nKey="plugins.details.modal.title">Report a plugin concern</Trans>}
          isOpen
          onDismiss={() => setReportAbuseModalOpen(false)}
        >
          <Stack direction="column" gap={2}>
            <Text>
              <Trans i18nKey="plugins.details.modal.description">
                This feature is for reporting malicious or harmful behaviour within plugins. For plugin concerns, email
                us at:{' '}
              </Trans>
              <TextLink href="mailto:integrations+report-plugin@grafana.com">integrations@grafana.com</TextLink>
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
              <Trans i18nKey="plugins.details.modal.cancel">Cancel</Trans>
            </Button>
            <Button icon="copy" onClick={() => navigator.clipboard.writeText('integrations@grafana.com')}>
              <Trans i18nKey="plugins.details.modal.copyEmail">Copy email address</Trans>
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
