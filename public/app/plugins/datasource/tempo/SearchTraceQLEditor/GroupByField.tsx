import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { HorizontalGroup, Select, useStyles2 } from '@grafana/ui';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

import InlineSearchField from './InlineSearchField';
import { replaceAt } from './utils';

interface Props {
  datasource: TempoDatasource;
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
  isTagsLoading: boolean;
}

export const GroupByField = (props: Props) => {
  const { datasource, onChange, query, isTagsLoading } = props;
  const styles = useStyles2(getStyles);
  const generateId = () => uuidv4().slice(0, 8);

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
      label="Aggregate by"
      tooltip="Select one or more tags to see the metrics summary. Note: the metrics summary API only considers spans of kind = server."
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
                aria-label={`Select scope for filter ${i + 1}`}
              />
              <Select
                options={getTags(f)?.map((t) => ({
                  label: t,
                  value: t,
                }))}
                value={f.tag || ''}
                onChange={(v) => {
                  updateFilter({ ...f, tag: v?.value });
                }}
                placeholder="Select tag"
                aria-label={`Select tag for filter ${i + 1}`}
                isLoading={isTagsLoading}
                isClearable
              />
              <AccessoryButton
                variant="secondary"
                icon="times"
                onClick={() => removeFilter(f)}
                tooltip="Remove tag"
                aria-label={`Remove tag for filter ${i + 1}`}
              />

              {i === (query.groupBy?.length ?? 0) - 1 && (
                <span className={styles.addFilter}>
                  <AccessoryButton
                    variant="secondary"
                    icon="plus"
                    onClick={() => addFilter()}
                    tooltip="Add tag"
                    aria-label="Add tag"
                  />
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
