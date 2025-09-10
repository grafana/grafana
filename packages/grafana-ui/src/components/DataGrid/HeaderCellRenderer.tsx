import { css, cx } from '@emotion/css';
import { SortDirection } from 'react-data-grid';

import { Field, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

export interface HeaderCellRendererProps {
  field: Field;
  direction?: SortDirection;
}

export const HeaderCellRenderer = ({ field, direction }: HeaderCellRendererProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <span className={styles.headerCellLabel}>{getFieldDisplayName(field)}</span>
      {direction && (
        <Icon
          className={cx(styles.headerCellIcon, styles.headerSortIcon)}
          size="lg"
          name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
        />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerCellLabel: css({
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    marginBottom: theme.spacing(0.5),
    alignSelf: 'flex-end',
    color: theme.colors.text.secondary,
  }),
  headerSortIcon: css({
    marginBottom: theme.spacing(0.25),
  }),
});
