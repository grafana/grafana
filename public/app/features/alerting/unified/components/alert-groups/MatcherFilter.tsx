import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { FormEvent, useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, Input, Label, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { logInfo, LogMessages } from '../../Analytics';
import { parseMatchers } from '../../utils/alertmanager';

interface Props {
  defaultQueryString?: string;
  onFilterChange: (filterString: string) => void;
}

export const MatcherFilter = ({ onFilterChange, defaultQueryString }: Props) => {
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
  const inputInvalid = defaultQueryString ? parseMatchers(defaultQueryString).length === 0 : false;

  return (
    <Field
      className={styles.fixMargin}
      invalid={inputInvalid || undefined}
      error={inputInvalid ? 'Query must use valid matcher syntax. See the examples in the help tooltip.' : null}
      label={
        <Label>
          <Stack gap={0.5}>
            <span>Search by label</span>
            <Tooltip
              content={
                <div>
                  Filter alerts using label querying without spaces, ex:
                  <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
                  Invalid use of spaces:
                  <pre>{`{severity= "critical"}`}</pre>
                  <pre>{`{severity ="critical"}`}</pre>
                  Valid use of spaces:
                  <pre>{`{severity=" critical"}`}</pre>
                  Filter alerts using label querying without braces, ex:
                  <pre>{`severity="critical", instance=~"cluster-us-.+"`}</pre>
                </div>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        </Label>
      }
    >
      <Input
        placeholder="Search"
        defaultValue={defaultQueryString ?? ''}
        onChange={onSearchInputChanged}
        data-testid="search-query-input"
        prefix={searchIcon}
        className={styles.inputWidth}
      />
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fixMargin: css({
    marginBottom: 0,
  }),
  inputWidth: css({
    width: 340,
    flexGrow: 0,
  }),
});
