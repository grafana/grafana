import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

import { OptionProps } from 'react-select/src/components/Option';
import { TagBadge } from './TagBadge';

// https://github.com/JedWatson/react-select/issues/3038
interface ExtendedOptionProps extends OptionProps<any> {
  data: any;
}

export const TagOption: FC<ExtendedOptionProps> = ({ data, className, label, isFocused, innerProps }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={cx(styles.option, isFocused && styles.optionFocused)} aria-label="Tag option" {...innerProps}>
      <div className={`tag-filter-option ${className || ''}`}>
        <TagBadge label={label} removeIcon={false} count={data.count} />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    option: css`
      padding: 8px;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
      &:hover {
        background: ${theme.colors.dropdownOptionHoverBg};
      }
    `,
    optionFocused: css`
      background: ${theme.colors.dropdownOptionHoverBg};
      border-style: solid;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-left-width: 2px;
    `,
  };
});
