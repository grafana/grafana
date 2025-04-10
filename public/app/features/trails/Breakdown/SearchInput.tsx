import { css } from '@emotion/css';
import { HTMLProps } from 'react';

import { Icon, Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'width'> {
  onClear(): void;
}

export const SearchInput = ({ value, onChange, placeholder, onClear, ...rest }: Props) => {
  return (
    <Input
      value={value}
      onChange={onChange}
      suffix={
        value ? (
          <Icon
            onClick={onClear}
            title={t('trails.search-input.title-clear-search', 'Clear search')}
            name="times"
            className={styles.clearIcon}
          />
        ) : undefined
      }
      prefix={<Icon name="search" />}
      placeholder={placeholder}
      {...rest}
    />
  );
};

const styles = {
  clearIcon: css({
    cursor: 'pointer',
  }),
};
