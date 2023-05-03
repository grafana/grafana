import { css, cx } from '@emotion/css';
import React from 'react';
import { OptionProps } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TagBadge } from './TagBadge';

export const TagOption = ({ data, className, label, isFocused, innerProps }: OptionProps<any, any>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.option, isFocused && styles.optionFocused)} aria-label="Tag option" {...innerProps}>
      <div className={`tag-filter-option ${className || ''}`}>
        {typeof label === 'string' ? <TagBadge label={label} removeIcon={false} count={data.count ?? 0} /> : label}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    option: css`
      padding: 8px;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
    optionFocused: css`
      background: ${theme.colors.background.secondary};
      border-style: solid;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-left-width: 2px;
    `,
  };
};
