import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

import InlineSearchField from './InlineSearchField';
import { replaceAt } from './utils';

interface Props {
  datasource: TempoDatasource;
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

export const GroupByField = (props: Props) => {
  const { datasource, onChange, query } = props;
  const styles = useStyles2(getStyles);
  const generateId = () => uuidv4().slice(0, 8);
  const [isTagsLoading, setIsTagsLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start();
        setIsTagsLoading(false);
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchTags();
  }, [datasource]);

  useEffect(() => {
    if (!query.groupBy || query.groupBy.length === 0) {
      onChange({
        ...query,
        groupBy: [
          {
            id: generateId(),
            scope: TraceqlSearchScope.Span,
          },
        ],
      });
    }
  }, [onChange, query]);

  const getTags = (f: TraceqlFilter) => {
    return datasource!.languageProvider.getMetricsSummaryTags(f.scope);
  };

  const addFilter = () => {
    updateFilter({
      id: generateId(),
      scope: TraceqlSearchScope.Span,
    });
  };

  const removeFilter = (filter: TraceqlFilter) => {
    onChange({ ...query, groupBy: query.groupBy?.filter((f) => f.id !== filter.id) });
  };

  const updateFilter = (filter: TraceqlFilter) => {
    const copy = { ...query };
    copy.groupBy ||= [];
    const indexOfFilter = copy.groupBy.findIndex((f) => f.id === filter.id);
    if (indexOfFilter >= 0) {
      copy.groupBy = replaceAt(copy.groupBy, indexOfFilter, filter);
    } else {
      copy.groupBy.push(filter);
    }
    onChange(copy);
  };

  const scopeOptions = Object.values(TraceqlSearchScope).map((t) => ({ label: t, value: t }));

  return (
    <InlineSearchField
      label="Group By"
      tooltip="Select a tag to see the metrics summary. Note: the metrics summary API only considers spans of kind = server."
    >
      <>
        {query.groupBy?.map((f, i) => (
          <div key={f.id}>
            <HorizontalGroup spacing={'none'} width={'auto'}>
              <Select
                options={scopeOptions}
                value={f.scope}
                onChange={(v) => {
                  updateFilter({ ...f, scope: v?.value });
                }}
                placeholder="Select scope"
                aria-label={`Select scope for ${f.id}`}
              />
              <Select
                options={getTags(f).map((t) => ({
                  label: t,
                  value: t,
                }))}
                value={f.tag || ''}
                onChange={(v) => {
                  updateFilter({ ...f, tag: v?.value });
                }}
                placeholder="Select tag"
                aria-label={`Select tag for ${f.id}`}
                isLoading={isTagsLoading}
                isClearable
              />
              <AccessoryButton variant="secondary" icon="times" onClick={() => removeFilter(f)} tooltip="Remove tag" />

              {i === (query.groupBy?.length ?? 0) - 1 && (
                <span className={styles.addFilter}>
                  <AccessoryButton variant="secondary" icon="plus" onClick={() => addFilter()} title="Add tag" />
                </span>
              )}
            </HorizontalGroup>
          </div>
        ))}
      </>
    </InlineSearchField>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addFilter: css`
    margin-left: ${theme.spacing(2)};
  `,
});
