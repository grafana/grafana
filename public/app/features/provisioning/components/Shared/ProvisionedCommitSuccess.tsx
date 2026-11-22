import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Divider, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepoTypeDisplay, type RepoType } from 'app/features/provisioning/Wizard/types';

import { getBranchUrl } from '../utils/url';

/** The commit this drawer just made, which picks the success copy. */
export type CommitAction = 'create' | 'update' | 'delete' | 'move';

interface Props {
  action: CommitAction;
  /** Branch the commit landed on. Omitted when it went straight to the configured branch. */
  branch?: string;
  configuredBranch?: string;
  repoType?: RepoType;
  /** Repository base URL, for the branch links. */
  repoUrl?: string;
  /** The commit message, shown as the last commit. */
  commitMessage?: string;
  /** Hash the write landed on, shown abbreviated next to the message. */
  commitHash?: string;
  /** Link to the committed file at `commitHash`. */
  sourceUrl?: string;
  /** How many resources the commit covers. Bulk actions pass their selection count. */
  count?: number;
}

/**
 * What the drawer shows once the commit lands: where the change went, and where to go next.
 *
 * The two states differ in consequence, not just in wording — a commit on the configured branch is
 * dual-written, so it is already live for the whole organization, while a commit on another branch
 * exists only on that branch until the pull request merges.
 */
export function ProvisionedCommitSuccess({
  action,
  branch,
  configuredBranch,
  repoType,
  repoUrl,
  commitMessage,
  commitHash,
  sourceUrl,
  count = 1,
}: Props) {
  const styles = useStyles2(getStyles);
  const isDirect = !branch || branch === configuredBranch;
  const hasCommit = Boolean(commitMessage || commitHash);
  // Git hashes are 40 characters; the drawer is narrow and the first 7 identify a commit.
  const shortHash = commitHash?.slice(0, 7);
  const provider = repoType ? RepoTypeDisplay[repoType] : t('provisioning.commit-success.repository', 'the repository');

  return (
    <Stack direction="column" gap={3}>
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon name="check-circle" className={styles.successIcon} />
        <Stack direction="column" gap={0.5}>
          <Text weight="medium">
            {isDirect ? getDirectHeadline(branch || configuredBranch) : getBranchHeadline(action, provider, count)}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {isDirect ? (
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
        </Stack>
      </Stack>

      {(!isDirect || hasCommit) && (
        <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={2}>
          <Stack direction="column" gap={2}>
            {!isDirect && (
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
                    {shortHash && <code className={cx(styles.code, styles.hash)}>{`${shortHash} `}</code>}
                    {commitMessage && <code className={styles.code}>{commitMessage}</code>}
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
                    aria-label={t('provisioning.commit-success.open-commit', 'Open the committed file at {{hash}}', {
                      hash: shortHash,
                    })}
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
          // Branch names contain slashes, which i18n would escape into the label.
          aria-label={t('provisioning.commit-success.open-branch', 'Open {{branch}} in the repository', {
            branch,
            interpolation: { escapeValue: false },
          })}
        />
      )}
    </Stack>
  );
}

/** A repository without a configured branch (a local one, say) has no branch to name. */
function getDirectHeadline(branch?: string): string {
  return branch
    ? t('provisioning.commit-success.committed-to', 'Committed to {{branch}}.', { branch })
    : t('provisioning.commit-success.committed', 'Changes committed.');
}

function getBranchHeadline(action: CommitAction, provider: string, count: number): string {
  switch (action) {
    case 'update':
      return t('provisioning.commit-success.title-updated', '', {
        count,
        provider,
        defaultValue_one: 'The resource has been updated in a branch in {{provider}}.',
        defaultValue_other: 'The resources have been updated in a branch in {{provider}}.',
      });
    case 'delete':
      return t('provisioning.commit-success.title-deleted', '', {
        count,
        provider,
        defaultValue_one: 'The resource has been deleted in a branch in {{provider}}.',
        defaultValue_other: 'The resources have been deleted in a branch in {{provider}}.',
      });
    case 'move':
      return t('provisioning.commit-success.title-moved', '', {
        count,
        provider,
        defaultValue_one: 'The resource has been moved in a branch in {{provider}}.',
        defaultValue_other: 'The resources have been moved in a branch in {{provider}}.',
      });
    default:
      return t('provisioning.commit-success.title-created', '', {
        count,
        provider,
        defaultValue_one: 'A new resource has been created in a branch in {{provider}}.',
        defaultValue_other: 'New resources have been created in a branch in {{provider}}.',
      });
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
  // Without this the commit message, which can be any length, pushes the repository link out of
  // the row instead of wrapping.
  commit: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  // The hash identifies the commit; the message is what the reader is actually scanning for.
  hash: css({
    color: theme.colors.text.secondary,
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
