import { css } from '@emotion/css';
import { debounce, uniqueId } from 'lodash';
import { FormEvent, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Icon, Input, Label, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { parsePromQLStyleMatcherLoose } from '../../utils/matchers';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';

const getQueryStringKey = () => uniqueId('query-string-');

export const SilencesFilter = () => {
  const [queryStringKey, setQueryStringKey] = useState(getQueryStringKey());
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
  const styles = useStyles2(getStyles);

  const handleQueryStringChange = debounce((e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setQueryParams({ queryString: target.value || null });
  }, 400);

  const clearFilters = () => {
    setQueryParams({
      queryString: null,
      silenceState: null,
    });
    setTimeout(() => setQueryStringKey(getQueryStringKey()));
  };

  let inputValid = queryString && queryString.length > 3;
  try {
    if (!queryString) {
      inputValid = true;
    } else {
      parsePromQLStyleMatcherLoose(queryString);
    }
  } catch (err) {
    inputValid = false;
  }

  return (
    <div className={styles.flexRow}>
      <Field
        className={styles.rowChild}
        label={
          <Label>
            <Stack gap={0.5}>
              <Trans i18nKey="alerting.common.search-by-matchers">Search by matchers</Trans>
              <Tooltip
                content={
                  <>
                    <div>
                      <Trans i18nKey="alerting.silences-filter.search-by-matchers-tooltip">
                        Filter silences by using a comma separated list of matchers, e.g.
                      </Trans>
                    </div>

                    {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                    <pre>severity=critical, env=production</pre>
                  </>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
        invalid={!inputValid}
        error={!inputValid ? 'Query must use valid matcher syntax' : null}
      >
        <Input
          key={queryStringKey}
          className={styles.searchInput}
          prefix={<Icon name="search" />}
          onChange={handleQueryStringChange}
          defaultValue={queryString ?? ''}
          placeholder={t('alerting.silences-filter.search-query-input-placeholder-search', 'Search')}
          data-testid="search-query-input"
        />
      </Field>

      {queryString && (
        <div className={styles.rowChild}>
          <Button variant="secondary" icon="times" onClick={clearFilters}>
            <Trans i18nKey="alerting.common.clear-filters">Clear filters</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css({
    width: '360px',
  }),
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: theme.spacing(3),
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
  rowChild: css({
    marginRight: theme.spacing(1),
    marginBottom: 0,
    maxHeight: '52px',
  }),
  fieldLabel: css({
    fontSize: '12px',
    fontWeight: 500,
  }),
});
