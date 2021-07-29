import React, { FormEvent } from 'react';
import { Label, Tooltip, Input, Icon, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  onFilterChange: (filterString: string) => void;
}

export const AmNotificationsMatcherFilter = (props: Props) => {
  const styles = useStyles2(getStyles);
  const handleSearchChange = (e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    props.onFilterChange(target.value);
  };
  return (
    <div className={styles.wrapper}>
      <Label>
        <Tooltip
          content={
            <div>
              Filter rules and alerts using label querying, ex:
              <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
            </div>
          }
        >
          <Icon className={styles.icon} name="info-circle" size="xs" />
        </Tooltip>
        Search by label
      </Label>
      <Input placeholder="Search" onChange={handleSearchChange} data-testid="search-query-input" />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 340px;
    margin-left: ${theme.spacing(1)};
  `,
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
});
