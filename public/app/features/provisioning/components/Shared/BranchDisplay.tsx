import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { getBranchUrl } from '../utils/url';

interface Props {
  baseUrl: string;
  branch: string;
  repoType?: string;
}

/**
 * @description Renders a branch name as a GitHub-like pill. When the repo type resolves to a
 * browsable branch URL the pill is a link that opens the branch in a new tab; otherwise it is
 * rendered as plain, non-interactive text.
 */
export function BranchDisplay({ baseUrl, branch, repoType }: Props) {
  const styles = useStyles2(getStyles);
  const link = getBranchUrl(baseUrl, branch, repoType);

  const content = (
    <>
      <Icon name="code-branch" size="xs" className={styles.branchIcon} />
      <span className={styles.branchName}>{branch}</span>
    </>
  );

  if (link.length) {
    return (
      <a
        href={textUtil.sanitizeUrl(link)}
        target="_blank"
        rel="noopener noreferrer"
        className={cx(styles.branchPill, styles.branchPillLink)}
      >
        {content}
      </a>
    );
  }

  return <span className={styles.branchPill}>{content}</span>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  branchPill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    maxWidth: '100%',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    color: theme.colors.text.primary,
    verticalAlign: 'middle',
  }),
  branchPillLink: css({
    color: theme.colors.text.link,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none',
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.action.hover,
    },
  }),
  branchIcon: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  branchName: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
