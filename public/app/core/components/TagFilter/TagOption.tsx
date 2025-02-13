import { css, cx } from '@emotion/css';
import { OptionProps } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TagBadge } from './TagBadge';

export interface TagSelectOption {
  value: string;
  label: string;
  count: number;
}

export const TagOption = ({ data, className, label, isFocused, innerProps }: OptionProps<TagSelectOption>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.option, isFocused && styles.optionFocused)} aria-label="Tag option" {...innerProps}>
      <div className={cx(styles.optionInner, className)}>
        {typeof label === 'string' ? <TagBadge label={label} removeIcon={false} count={data.count ?? 0} /> : label}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    option: css({
      padding: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderLeft: '2px solid transparent',
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    optionFocused: css({
      background: theme.colors.action.focus,
      borderStyle: 'solid',
      borderTop: 0,
      borderRight: 0,
      borderBottom: 0,
      borderLeftWidth: '2px',
    }),
    optionInner: css({
      position: 'relative',
      textAlign: 'left',
      width: '100%',
      display: 'block',
      cursor: 'pointer',
      padding: '2px 0',
    }),
  };
};
