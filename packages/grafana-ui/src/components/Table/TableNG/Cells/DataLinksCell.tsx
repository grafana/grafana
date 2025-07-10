import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksCellProps } from '../types';
import { getCellLinks } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const styles = useStyles2(getStyles);

  const links = getCellLinks(field, rowIdx!);

  return (
    <div className={styles.container}>
      {links &&
        links.map((link, idx) =>
          !link.href && link.onClick == null ? (
            <span key={idx} className={styles.linkCell}>
              {link.title}
            </span>
          ) : (
            <a
              className={cx(styles.linkCell, styles.linkCellActive)}
              key={idx}
              onClick={link.onClick}
              href={link.href}
              target={link.target}
            >
              {link.title}
            </a>
          )
        )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexWrap: 'nowrap',
    gap: theme.spacing(0.5),
  }),
  linkCell: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexShrink: 0,
    userSelect: 'text',
    whiteSpace: 'nowrap',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  linkCellActive: css({
    cursor: 'pointer',
    color: theme.colors.text.link,
    a: {
      color: theme.colors.text.link,
    },
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});
