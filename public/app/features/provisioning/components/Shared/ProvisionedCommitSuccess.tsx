import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Divider, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepoTypeDisplay } from 'app/features/provisioning/Wizard/types';

import { getBranchUrl } from '../utils/url';

import { type CommitAction, type ProvisionedCommitOutcome, isDirectCommit } from './provisionedCommitOutcome';

interface Props {
  outcome: ProvisionedCommitOutcome;
}

export function ProvisionedCommitSuccess({ outcome }: Props) {
  const { action, branch, configuredBranch, repoType, repoUrl, message: commitMessage, sourceUrl } = outcome;
  const styles = useStyles2(getStyles);
  const isDirect = isDirectCommit(outcome);
  const hasCommit = Boolean(commitMessage);
  const provider = repoType ? RepoTypeDisplay[repoType] : t('provisioning.commit-success.repository', 'the repository');

  return (
    <Stack direction="column" gap={3}>
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon name="check-circle" className={styles.successIcon} />
        <Stack direction="column" gap={0.5} role="status">
          <Text weight="medium">
            {isDirect ? getDirectHeadline(branch || configuredBranch) : getBranchHeadline(action, provider)}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {isDirect && outcome.pendingSync ? (
              <Trans i18nKey="provisioning.commit-success.pending-sync-body">
                Grafana applies this version the next time it syncs the repository.
              </Trans>
            ) : isDirect ? (
              <Trans i18nKey="provisioning.commit-success.direct-body">
                This version is already live in Grafana for everyone in your organization.
              </Trans>
            ) : (
              <Trans i18nKey="provisioning.commit-success.branch-body">
                The rest of the Grafana users in your organization will still see the current version saved to the
                configured branch until this branch is merged.
              </Trans>
            )}
          </Text>
          {!isDirect && repoType === 'git' && (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="provisioning.commit-success.open-pull-request-yourself">
                Open the repository and create a pull or merge request from the branch you saved to.
              </Trans>
            </Text>
          )}
        </Stack>
      </Stack>

      {(!isDirect || hasCommit) && (
        <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={2}>
          <Stack direction="column" gap={2}>
            {!isDirect && branch && (
              <>
                <BranchRow
                  label={t('provisioning.commit-success.your-branch', 'Your branch')}
                  branch={branch}
                  href={repoUrl && getBranchUrl(repoUrl, branch, repoType)}
                />
                {configuredBranch && (
                  <BranchRow
                    label={t('provisioning.commit-success.merges-into', 'Merges into')}
                    branch={configuredBranch}
                    note={t('provisioning.commit-success.configured-branch', 'configured branch')}
                    href={repoUrl && getBranchUrl(repoUrl, configuredBranch, repoType)}
                  />
                )}
                {hasCommit && <Divider spacing={0} />}
              </>
            )}
            {hasCommit && (
              <Stack direction="row" gap={1} alignItems="flex-start" justifyContent="space-between">
                <div className={styles.commit}>
                  <Text variant="bodySmall" color="secondary">
                    <Trans i18nKey="provisioning.commit-success.last-commit">Last commit</Trans>
                  </Text>
                  <span>
                    <code className={styles.code}>{commitMessage}</code>
                  </span>
                </div>
                {sourceUrl && (
                  <LinkButton
                    href={sourceUrl}
                    target="_blank"
                    variant="secondary"
                    fill="text"
                    size="sm"
                    icon="external-link-alt"
                    aria-label={t('provisioning.commit-success.open-commit', 'Open the committed file')}
                  />
                )}
              </Stack>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

interface BranchRowProps {
  label: string;
  branch: string;
  note?: string;
  href?: string;
}

function BranchRow({ label, branch, note, href }: BranchRowProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="flex-start" justifyContent="space-between">
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon name="code-branch" className={styles.branchIcon} />
        <Stack direction="column" gap={0}>
          <Text variant="bodySmall" color="secondary">
            {label}
          </Text>
          <span>
            <code className={styles.code}>{branch}</code>
            {note && (
              <Text variant="bodySmall" color="secondary">
                {` · ${note}`}
              </Text>
            )}
          </span>
        </Stack>
      </Stack>
      {href && (
        <LinkButton
          href={href}
          target="_blank"
          variant="secondary"
          fill="text"
          size="sm"
          icon="external-link-alt"
          aria-label={t('provisioning.commit-success.open-branch', 'Open {{branch}} in the repository', {
            branch,
            interpolation: { escapeValue: false },
          })}
        />
      )}
    </Stack>
  );
}

function getDirectHeadline(branch?: string): string {
  return branch
    ? t('provisioning.commit-success.committed-to', 'Committed to {{branch}}.', { branch })
    : t('provisioning.commit-success.committed', 'Changes committed.');
}

function getBranchHeadline(action: CommitAction, provider: string): string {
  switch (action) {
    case 'update':
      return t(
        'provisioning.commit-success.title-updated',
        'The resource has been updated in a branch in {{provider}}.',
        {
          provider,
        }
      );
    case 'delete':
      return t(
        'provisioning.commit-success.title-deleted',
        'The resource has been deleted in a branch in {{provider}}.',
        {
          provider,
        }
      );
    default:
      return t(
        'provisioning.commit-success.title-created',
        'A new resource has been created in a branch in {{provider}}.',
        {
          provider,
        }
      );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  successIcon: css({
    color: theme.colors.success.text,
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  }),
  branchIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
    marginTop: theme.spacing(0.5),
  }),
  commit: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  code: css({
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: 0,
    wordBreak: 'break-all',
  }),
});
