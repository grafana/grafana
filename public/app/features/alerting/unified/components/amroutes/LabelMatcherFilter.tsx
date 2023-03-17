import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { ChangeEvent, useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Label, Input, Icon, useStyles2 } from '@grafana/ui';

import { LogMessages } from '../../Analytics';
import { HoverCard } from '../HoverCard';

interface Props {
  className?: string;
  defaultQueryString?: string;
  onFilterChange: (filterString: string) => void;
}

export const LabelMatcherFilter = ({ className, onFilterChange, defaultQueryString }: Props) => {
  const styles = useStyles2(getStyles);

  const onSearchInputChanged = useMemo(
    () =>
      debounce((e: ChangeEvent<HTMLInputElement>) => {
        logInfo(LogMessages.filterPoliciesByMatchers);
        onFilterChange(e.target.value);
      }, 600),
    [onFilterChange]
  );

  useEffect(() => onSearchInputChanged.cancel(), [onSearchInputChanged]);

  const searchIcon = <Icon name={'search'} />;

  return (
    <div className={className}>
      <Label>
        <Stack gap={0.5}>
          <span>Search by matcher</span>
          <HoverCard
            content={
              <div className={styles.hoverContent}>
                Filter notification policies by <span className={styles.bold}>matchers</span>
                <div className={styles.textBlock}>
                  Notification policies are characterized by labels matchers rathen than labels. <br />
                  Filtering by matchers means we compare if matchers are equal contrary to checking if a label matches a
                  matcher.
                </div>
                <div className={styles.textBlock}>
                  According to that, e.g. <code>severity=critical</code> equals only <code>severity=critical</code>
                  <br />
                  and <span className={styles.bold}>is not equal</span> <code>severity=~critical</code>
                  <br />
                  This is an important distinction from how filtering of alert rules works
                </div>
                <hr />
                Filter policies using matchers querying, e.g.:
                <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
              </div>
            }
          >
            <Icon className={styles.icon} name="info-circle" size="sm" />
          </HoverCard>
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
  bold: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  textBlock: css`
    padding: ${theme.spacing(1, 0)};
  `,
  hoverContent: css`
    max-width: 600px;
  `,
});
