import { InlineField, Input, QueryField } from '@grafana/ui';
import { useReducerCallback } from 'app/plugins/datasource/elasticsearch/hooks/useReducerCallback';
import { css } from 'emotion';
import React, { FunctionComponent } from 'react';
import { AddRemove } from '../../../AddRemove';
import { useDispatch } from '../../../ElasticsearchQueryContext';
import { changeBucketAggregationSetting } from '../../state/actions';
import { BucketAggregationAction, Filters } from '../../state/types';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';
import { defaultFilter } from './utils';

interface Props {
  value: Filters;
}

export const FiltersSettingsEditor: FunctionComponent<Props> = ({ value }) => {
  const upperStateDispatch = useDispatch<BucketAggregationAction<Filters>>();

  const dispatch = useReducerCallback(
    newState => upperStateDispatch(changeBucketAggregationSetting(value, 'filters', newState)),
    value.settings?.filters || [],
    filtersReducer
  );

  return (
    <>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        {(value.settings?.filters || [defaultFilter()]).map((filter, index) => {
          // TODO: Here we should have a unique key, not sure if we can get it from the fields
          return (
            <div
              className={css`
                display: flex;
              `}
            >
              <div
                className={css`
                  width: 250px;
                `}
              >
                <InlineField label="Query" labelWidth={10}>
                  <QueryField
                    placeholder="Lucene Query"
                    portalOrigin="elasticsearch"
                    // FIXME: There's a weird thing happening with this field:
                    // when an error is thrown it becomes impossible to remove focus from this element
                    onChange={query => dispatch(changeFilter(index, { ...filter, query }))}
                    query={filter.query}
                  />
                </InlineField>
              </div>
              <InlineField label="Label" labelWidth={10}>
                <Input
                  placeholder="Label"
                  onBlur={e => dispatch(changeFilter(index, { ...filter, label: e.target.value }))}
                  defaultValue={filter.label}
                />
              </InlineField>
              <AddRemove
                index={index}
                elements={value.settings?.filters || []}
                onAdd={() => dispatch(addFilter())}
                onRemove={() => dispatch(removeFilter(index))}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};
