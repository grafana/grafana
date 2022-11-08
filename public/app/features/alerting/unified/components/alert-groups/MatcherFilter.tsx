import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { FormEvent, useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Label, Tooltip, Input, Icon, useStyles2 } from '@grafana/ui';

import { LogMessages } from '../../Analytics';

interface Props {
  className?: string;
  defaultQueryString?: string;
  onFilterChange: (filterString: string) => void;
}

export const MatcherFilter = ({ className, onFilterChange, defaultQueryString }: Props) => {
  const styles = useStyles2(getStyles);

  const onSearchInputChanged = useMemo(
    () =>
      debounce((e: FormEvent<HTMLInputElement>) => {
        logInfo(LogMessages.filterByLabel);

        const target = e.target as HTMLInputElement;
        onFilterChange(target.value);
      }, 600),
    [onFilterChange]
  );

  useEffect(() => onSearchInputChanged.cancel(), [onSearchInputChanged]);

  const searchIcon = <Icon name={'search'} />;

  return (
    <div className={className}>
      <Label>
        <Stack gap={0.5}>
          <span>Search by label</span>
          <Tooltip
            content={
              <div>
                Filter alerts using label querying, ex:
                <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
              </div>
            }
          >
            <Icon className={styles.icon} name="info-circle" size="sm" />
          </Tooltip>
        </Stack>
      </Label>
      <Input
        placeholder="Search"
        defaultValue={defaultQueryString}
        onChange={onSearchInputChanged}
        data-testid="search-query-input"
        prefix={searchIcon}
        className={styles.inputWidth}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
  inputWidth: css`
    width: 340px;
    flex-grow: 0;
  `,
});
