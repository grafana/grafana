import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { DataLinksCellProps } from '../types';
import { getCellLinks } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const styles = useStyles2(getStyles);

  const links = getCellLinks(field, rowIdx!);

  return (
    <div>
      {links &&
        links.map((link, idx) => {
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span key={idx} className={styles.linkCell} onClick={link.onClick}>
              <a href={link.href} target={link.target}>
                {link.title}
              </a>
            </span>
          );
        })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  linkCell: css({
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'text',
    whiteSpace: 'nowrap',
    color: theme.colors.text.link,
    fontWeight: theme.typography.fontWeightMedium,
    paddingRight: theme.spacing(1.5),
    a: {
      color: theme.colors.text.link,
    },
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});
