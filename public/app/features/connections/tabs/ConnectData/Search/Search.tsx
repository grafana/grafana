import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Icon, Input, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2, headerHeight: number) => ({
  searchContainer: css({
    display: 'flex',
    justifyContent: 'space-between',

    position: 'sticky',
    top: headerHeight,
    backgroundColor: theme.colors.background.primary,
    zIndex: 2,
    padding: theme.spacing(2, 0),
  }),
});

export interface Props {
  onChange: (e: React.FormEvent<HTMLInputElement>) => void;
  value: string | undefined;
}

export const Search = ({ onChange, value }: Props) => {
  const chromeHeaderHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, chromeHeaderHeight ?? 0);
  const { t } = useTranslate();
  const placeholder = t('connections.search.placeholder', 'Search all');

  return (
    <div className={styles.searchContainer}>
      <Input
        value={value}
        onChange={onChange}
        prefix={<Icon name="search" />}
        placeholder={placeholder}
        aria-label={t('connections.search.aria-label-search-all', 'Search all')}
      />
    </div>
  );
};
