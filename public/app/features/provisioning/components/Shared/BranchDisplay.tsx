import { css } from '@emotion/css';

import { Badge, TextLink, useStyles2 } from '@grafana/ui';

import { getBranchUrl } from '../utils/url';

interface Props {
  baseUrl: string;
  branch: string;
  repoType?: string;
  /** Stable e2e selector wired onto the rendered pill. */
  dataTestId?: string;
}

/**
 * @description Renders a branch name as a badge. When the repo type resolves to a browsable
 * branch URL the badge contains a link that opens the branch in a new tab; otherwise the branch
 * name is rendered as plain, non-interactive text.
 */
export function BranchDisplay({ baseUrl, branch, repoType, dataTestId }: Props) {
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

const getStyles = () => ({
  // Vertically center the branch/external icons with the branch name.
  badge: css({
    alignItems: 'center',
  }),
});
