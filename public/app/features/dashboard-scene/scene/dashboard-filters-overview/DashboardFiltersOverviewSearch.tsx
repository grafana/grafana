import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Input, useStyles2 } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DashboardFiltersOverviewSearch({
  value,
  onChange,
  placeholder = t('dashboard.filters-overview.search.placeholder', 'Search...'),
}: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onChange('');
          }
        }}
        placeholder={placeholder}
        aria-label={t('dashboard.filters-overview.search.aria-label', 'Search filters')}
        prefix={<Icon name="search" />}
        className={styles.input}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
  }),
  input: css({
    width: '100%',
  }),
});
