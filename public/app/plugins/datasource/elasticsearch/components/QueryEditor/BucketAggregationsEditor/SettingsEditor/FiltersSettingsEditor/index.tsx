import { InlineField, Input, QueryField } from '@grafana/ui';
import { css } from 'emotion';
import React, { FunctionComponent, useEffect } from 'react';
import { AddRemove } from '../../../../AddRemove';
import { useDispatch, useStatelessReducer } from '../../../../../hooks/useStatelessReducer';
import { Filters } from '../../aggregations';
import { changeBucketAggregationSetting } from '../../state/actions';
import { BucketAggregationAction } from '../../state/types';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';

interface Props {
  value: Filters;
}

export const FiltersSettingsEditor: FunctionComponent<Props> = ({ value }) => {
  const upperStateDispatch = useDispatch<BucketAggregationAction<Filters>>();

  const dispatch = useStatelessReducer(
    (newState) => upperStateDispatch(changeBucketAggregationSetting(value, 'filters', newState)),
    value.settings?.filters,
    filtersReducer
  );

  // The model might not have filters (or an empty array of filters) in it because of the way it was built in previous versions of the datasource.
  // If this is the case we add a default one.
  useEffect(() => {
    if (!value.settings?.filters?.length) {
      dispatch(addFilter());
    }
  }, []);

  return (
    <>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        {value.settings?.filters!.map((filter, index) => (
          <div
            key={index}
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
                  onBlur={() => {}}
                  onChange={(query) => dispatch(changeFilter(index, { ...filter, query }))}
                  query={filter.query}
                />
              </InlineField>
            </div>
            <InlineField label="Label" labelWidth={10}>
              <Input
                placeholder="Label"
                onBlur={(e) => dispatch(changeFilter(index, { ...filter, label: e.target.value }))}
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
        ))}
      </div>
    </>
  );
};
