import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import React from 'react';
import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Link } from '../Link/Link';

/**
 * @internal
 */
export type ExternalLinkProps = {
  title: string;
  href: string;
  visible?: boolean;
};

/**
 * @internal
 */
export function ExternalLink(props: ExternalLinkProps): JSX.Element | null {
  const { title, href, visible = true } = props;
  const styles = useStyles2(getStyles);

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Link href={href} target="_blank" rel="noreferrer">
        <IconButton tooltip={title} tooltipPlacement="top" name="external-link-alt" size="sm" />
      </Link>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      padding-left: ${theme.spacing(0.75)};
    `,
  };
};
