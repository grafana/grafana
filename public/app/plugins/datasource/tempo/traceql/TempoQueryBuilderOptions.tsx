import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton, EditorField, EditorRow } from '@grafana/experimental';
import { AutoSizeInput, HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { replaceAt } from '../SearchTraceQLEditor/utils';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { DEFAULT_LIMIT, TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
  datasource: TempoDatasource;
}

export const TempoQueryBuilderOptions = React.memo<Props>(({ onChange, query, datasource }) => {
  const styles = useStyles2(getStyles);

  if (!query.hasOwnProperty('limit')) {
    query.limit = DEFAULT_LIMIT;
  }
  const collapsedInfoList = [`Limit: ${query.limit || DEFAULT_LIMIT}`];

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseInt(e.currentTarget.value, 10) });
  };

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
            valueType: 'string',
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
      valueType: 'string',
      scope: TraceqlSearchScope.Span,
    });
  };

  const removeFilter = (filter: TraceqlFilter) => {
    const copy = { ...query };
    onChange({ ...copy, groupBy: copy.groupBy?.filter((f) => f.id !== filter.id) });
  };

  const updateFilter = (filter: TraceqlFilter) => {
    const copy = { ...query };
    copy.groupBy ||= [];
    const indexOfFilter = copy.groupBy.findIndex((f) => f.id === filter.id);
    if (indexOfFilter >= 0) {
      // update in place if the filter already exists, for consistency and to avoid UI bugs
      copy.groupBy = replaceAt(copy.groupBy, indexOfFilter, filter);
    } else {
      copy.groupBy.push(filter);
    }
    onChange(copy);
  };

  const scopeOptions = Object.values(TraceqlSearchScope).map((t) => ({ label: t, value: t }));

  return (
    <>
      <EditorRow>
        <QueryOptionGroup title="Options" collapsedInfo={collapsedInfoList}>
          <EditorField label="Limit" tooltip="Maximum number of traces to return.">
            <AutoSizeInput
              className="width-4"
              placeholder="auto"
              type="number"
              min={1}
              defaultValue={query.limit || DEFAULT_LIMIT}
              onCommitChange={onLimitChange}
              value={query.limit}
            />
          </EditorField>
          <EditorField
            label="Group by"
            tooltip="Select a tag to see group by metrics. Note: the metrics summary API only considers spans of kind = server."
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
                      isLoading={isTagsLoading}
                      isClearable
                    />
                    <AccessoryButton
                      variant="secondary"
                      icon="times"
                      onClick={() => removeFilter(f)}
                      tooltip="Remove tag"
                    />

                    {i === (query.groupBy?.length ?? 0) - 1 && (
                      <span className={styles.addFilter}>
                        <AccessoryButton variant="secondary" icon="plus" onClick={() => addFilter()} title="Add tag" />
                      </span>
                    )}
                  </HorizontalGroup>
                </div>
              ))}
            </>
          </EditorField>
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
});

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';

const getStyles = (theme: GrafanaTheme2) => ({
  addFilter: css`
    margin-left: ${theme.spacing(2)};
  `,
});
