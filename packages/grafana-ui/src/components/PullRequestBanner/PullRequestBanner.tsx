import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { Badge } from '../Badge/Badge';
import { LinkButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { TextLink } from '../Link/TextLink';

/**
 * @alpha
 */
export interface PullRequestBannerBranchInfo {
  targetBranch?: string;
  configuredBranch?: string;
  repoBaseUrl?: string;
}

/**
 * @alpha
 */
export interface PullRequestBannerProps {
  prURL?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
  branchInfo?: PullRequestBannerBranchInfo;
  action?: string;
  originalUrl?: string;
  repoType?: string;
  prTitle?: string;
}

const REPO_TYPE_DISPLAY: Record<string, string> = {
  github: 'GitHub',
  githubEnterprise: 'GitHub Enterprise',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  git: 'Git',
  local: 'Local',
};

const GIT_PROVIDERS = new Set(['github', 'githubEnterprise', 'gitlab', 'bitbucket', 'git']);

const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

/**
 * Shows that a resource was saved to a branch of a Git Sync repository, with a link to the pull request.
 *
 * @alpha
 */
export function PullRequestBanner({
  prURL,
  isNewPr,
  behindBranch,
  repoUrl,
  branchInfo,
  action,
  originalUrl,
  repoType,
  prTitle,
}: PullRequestBannerProps) {
  const styles = useStyles2(getStyles);

  const repoTypeDisplay = (repoType && REPO_TYPE_DISPLAY[repoType]) || 'repository';
  const prLink = appendPullRequestTitleParam(prURL, repoType, prTitle);
  const hasPullRequestLink = Boolean(prLink) && repoType !== 'git';
  const branchLink =
    branchInfo?.repoBaseUrl && branchInfo?.targetBranch
      ? getBranchUrl(branchInfo.repoBaseUrl, branchInfo.targetBranch, repoType)
      : '';
  const linkUrl = prLink || branchLink || branchInfo?.repoBaseUrl || repoUrl;
  const actionText = getBannerText(action, isNewPr, repoTypeDisplay);

  if (behindBranch) {
    return (
      <Alert
        {...commonAlertProps}
        title={t(
          'grafana-ui.pull-request-banner.behind-branch-text',
          'This resource is behind the branch in {{repoType}}.',
          {
            repoType: repoTypeDisplay,
          }
        )}
        action={
          repoUrl && (
            <LinkButton href={repoUrl} target="_blank" variant="primary" icon="external-link-alt" iconPlacement="right">
              {t('grafana-ui.pull-request-banner.open-in-repo-button', 'Open in {{repoType}}', {
                repoType: repoTypeDisplay,
              })}
            </LinkButton>
          )
        }
      >
        <Trans i18nKey="grafana-ui.pull-request-banner.view-in-repo-button" values={{ repoType: repoTypeDisplay }}>
          View it in {{ repoType: repoTypeDisplay }} to see the latest changes.
        </Trans>
      </Alert>
    );
  }

  return (
    <Alert
      {...commonAlertProps}
      title={actionText.title}
      action={
        <Stack alignItems="center" wrap="wrap">
          {originalUrl && (
            <LinkButton href={originalUrl} variant="secondary" icon="arrow-left">
              {t('grafana-ui.pull-request-banner.view-saved-version', 'View saved version')}
            </LinkButton>
          )}
          {linkUrl && (
            <LinkButton href={linkUrl} target="_blank" variant="primary" icon="external-link-alt" iconPlacement="right">
              {hasPullRequestLink
                ? actionText.button
                : t('grafana-ui.pull-request-banner.open-repository', 'Open repository')}
            </LinkButton>
          )}
        </Stack>
      }
    >
      {actionText.body}

      {repoType === 'git' && (
        <Box marginTop={1}>
          <Trans i18nKey="grafana-ui.pull-request-banner.create-pull-request-in-repository">
            Open the repository and create a pull or merge request from the branch you saved to.
          </Trans>
        </Box>
      )}

      {showBranchInfo(repoType, branchInfo) && (
        <Box marginTop={1}>
          <span className={styles.branchRow}>
            <BranchBadge
              baseUrl={branchInfo.repoBaseUrl}
              branch={branchInfo.targetBranch}
              repoType={repoType}
              dataTestId={selectors.pages.Provisioning.PreviewBanner.sourceBranchLink}
            />
            <Icon
              name="arrow-right"
              size="sm"
              className={styles.arrow}
              aria-label={t('grafana-ui.pull-request-banner.branch-targets', 'targets')}
            />
            <BranchBadge
              baseUrl={branchInfo.repoBaseUrl}
              branch={branchInfo.configuredBranch}
              repoType={repoType}
              dataTestId={selectors.pages.Provisioning.PreviewBanner.targetBranchLink}
            />
          </span>
        </Box>
      )}
    </Alert>
  );
}

interface BranchBadgeProps {
  baseUrl: string;
  branch: string;
  repoType?: string;
  dataTestId?: string;
}

function BranchBadge({ baseUrl, branch, repoType, dataTestId }: BranchBadgeProps) {
  const styles = useStyles2(getStyles);
  const link = getBranchUrl(baseUrl, branch, repoType);
  const text = link.length ? (
    <TextLink href={link} external inline={false} variant="bodySmall" color="secondary">
      {branch}
    </TextLink>
  ) : (
    branch
  );

  return <Badge color="darkgrey" icon="code-branch" text={text} data-testid={dataTestId} className={styles.badge} />;
}

interface BannerText {
  title: string;
  body: string;
  button: string;
}

type BannerCopy = Omit<BannerText, 'button'>;

function getBannerText(action: string | undefined, isNewPr: boolean | undefined, repoType: string): BannerText {
  return { ...getBannerCopy(action, isNewPr, repoType), button: getButtonText(isNewPr, repoType) };
}

function getBannerCopy(action: string | undefined, isNewPr: boolean | undefined, repoType: string): BannerCopy {
  switch (action) {
    case 'delete':
      return {
        title: t(
          'grafana-ui.pull-request-banner.title-deleted',
          'A resource has been deleted in a branch in {{repoType}}.',
          {
            repoType,
          }
        ),
        body: t(
          'grafana-ui.pull-request-banner.body-deleted',
          'The rest of Grafana users in your organization will still see this resource until this branch is merged'
        ),
      };
    case 'update':
      return {
        title: t(
          'grafana-ui.pull-request-banner.title-updated',
          'A resource has been updated in a branch in {{repoType}}.',
          {
            repoType,
          }
        ),
        body: t(
          'grafana-ui.pull-request-banner.body-updated',
          'The rest of Grafana users in your organization will still see the current version until this branch is merged'
        ),
      };
    case 'move':
      return {
        title: t(
          'grafana-ui.pull-request-banner.title-moved',
          'A resource has been moved in a branch in {{repoType}}.',
          {
            repoType,
          }
        ),
        body: t(
          'grafana-ui.pull-request-banner.body-moved',
          'The rest of Grafana users in your organization will still see the current version until this branch is merged'
        ),
      };
    default:
      return {
        title: isNewPr
          ? t(
              'grafana-ui.pull-request-banner.title-created',
              'A new resource has been created in a branch in {{repoType}}.',
              {
                repoType,
              }
            )
          : t(
              'grafana-ui.pull-request-banner.title-loaded',
              'This resource is loaded from the branch you just created in {{repoType}} and it is only visible to you',
              { repoType }
            ),
        body: t(
          'grafana-ui.pull-request-banner.body-created',
          'The rest of Grafana users in your organization will still see the current version saved to configured default branch until this branch is merged'
        ),
      };
  }
}

function getButtonText(isNewPr: boolean | undefined, repoType: string): string {
  return isNewPr
    ? t('grafana-ui.pull-request-banner.open-pull-request', 'Open pull request in {{repoType}}', { repoType })
    : t('grafana-ui.pull-request-banner.view-pull-request', 'View pull request in {{repoType}}', { repoType });
}

function showBranchInfo(
  repoType: string | undefined,
  branchInfo?: PullRequestBannerBranchInfo
): branchInfo is Required<PullRequestBannerBranchInfo> {
  if (!repoType || !GIT_PROVIDERS.has(repoType)) {
    return false;
  }
  return Boolean(branchInfo?.targetBranch && branchInfo?.configuredBranch && branchInfo?.repoBaseUrl);
}

function appendPullRequestTitleParam(url: string | undefined, repoType: string | undefined, title: string | undefined) {
  if (!url || !title) {
    return url;
  }
  const paramName = repoType === 'gitlab' ? 'merge_request[title]' : 'title';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${paramName}=${encodeURIComponent(title)}`;
}

function getBranchUrl(baseUrl: string, branch: string, repoType?: string): string {
  const cleanBaseUrl = baseUrl
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git\/?$/i, '');
  switch (repoType) {
    case 'github':
    case 'githubEnterprise':
      return `${cleanBaseUrl}/tree/${branch}`;
    case 'gitlab':
      return `${cleanBaseUrl}/-/tree/${branch}`;
    case 'bitbucket':
      return `${cleanBaseUrl}/src/${branch}`;
    case 'git':
      return cleanBaseUrl;
    default:
      return '';
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  branchRow: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
  }),
  arrow: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  badge: css({
    alignItems: 'center',
  }),
});
