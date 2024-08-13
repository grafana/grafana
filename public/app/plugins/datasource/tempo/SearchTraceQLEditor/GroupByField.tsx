import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { HorizontalGroup, InputActionMeta, Select, useStyles2 } from '@grafana/ui';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

import InlineSearchField from './InlineSearchField';
import { maxOptions, withTemplateVariableOptions } from './SearchField';
import { replaceAt } from './utils';

interface Props {
  datasource: TempoDatasource;
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
  isTagsLoading: boolean;
  addVariablesToOptions?: boolean;
}

export const GroupByField = (props: Props) => {
  const { datasource, onChange, query, isTagsLoading, addVariablesToOptions } = props;
  const styles = useStyles2(getStyles);
  const generateId = () => uuidv4().slice(0, 8);
  const [tagQuery, setTagQuery] = useState<string>('');

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

  const tagOptions = useMemo(
    () => (f: TraceqlFilter) => {
      const tags = datasource!.languageProvider.getMetricsSummaryTags(f.scope);
      if (tagQuery.length === 0) {
        return tags.slice(0, maxOptions);
      }

      const queryLowerCase = tagQuery.toLowerCase();
      return tags.filter((tag) => tag.toLowerCase().includes(queryLowerCase)).slice(0, maxOptions);
    },
    [datasource, tagQuery]
  );

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
    <InlineSearchField label="Aggregate by" tooltip="Select one or more tags to see the metrics summary.">
      <>
        {query.groupBy?.map((f, i) => {
          const tags = tagOptions(f)
            ?.concat(f.tag !== undefined && !tagOptions(f)?.includes(f.tag) ? [f.tag] : [])
            .map((t) => ({
              label: t,
              value: t,
            }));
          return (
            <div key={f.id}>
              <HorizontalGroup spacing={'none'} width={'auto'}>
                <Select
                  aria-label={`Select scope for filter ${i + 1}`}
                  onChange={(v) => {
                    updateFilter({ ...f, scope: v?.value, tag: '' });
                  }}
                  options={scopeOptions}
                  placeholder="Select scope"
                  value={f.scope}
                />
                <Select
                  aria-label={`Select tag for filter ${i + 1}`}
                  isClearable
                  allowCustomValue
                  isLoading={isTagsLoading}
                  key={f.tag}
                  onChange={(v) => {
                    updateFilter({ ...f, tag: v?.value });
                  }}
                  options={addVariablesToOptions ? withTemplateVariableOptions(tags) : tags}
                  onInputChange={(value: string, { action }: InputActionMeta) => {
                    if (action === 'input-change') {
                      setTagQuery(value);
                    }
                  }}
                  onCloseMenu={() => setTagQuery('')}
                  placeholder="Select tag"
                  value={f.tag || ''}
                />
                {(f.tag || (query.groupBy?.length ?? 0) > 1) && (
                  <AccessoryButton
                    aria-label={`Remove tag for filter ${i + 1}`}
                    icon="times"
                    onClick={() => removeFilter(f)}
                    tooltip="Remove tag"
                    title={`Remove tag for filter ${i + 1}`}
                    variant="secondary"
                  />
                )}
                {f.tag && i === (query.groupBy?.length ?? 0) - 1 && (
                  <span className={styles.addTag}>
                    <AccessoryButton
                      aria-label="Add tag"
                      icon="plus"
                      onClick={() => addFilter()}
                      tooltip="Add tag"
                      variant="secondary"
                    />
                  </span>
                )}
              </HorizontalGroup>
            </div>
          );
        })}
      </>
    </InlineSearchField>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addTag: css({
    marginLeft: theme.spacing(1),
  }),
});
