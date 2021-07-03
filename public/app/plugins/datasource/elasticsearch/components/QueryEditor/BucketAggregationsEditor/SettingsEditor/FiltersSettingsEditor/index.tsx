import { InlineField, Input, QueryField } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { AddRemove } from '../../../../AddRemove';
import { useDispatch, useStatelessReducer } from '../../../../../hooks/useStatelessReducer';
import { Filters } from '../../aggregations';
import { changeBucketAggregationSetting } from '../../state/actions';
import { BucketAggregationAction } from '../../state/types';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';

interface Props {
  bucketAgg: Filters;
}

export const FiltersSettingsEditor = ({ bucketAgg }: Props) => {
  const upperStateDispatch = useDispatch<BucketAggregationAction<Filters>>();

  const dispatch = useStatelessReducer(
    (newState) => upperStateDispatch(changeBucketAggregationSetting(bucketAgg, 'filters', newState)),
    bucketAgg.settings?.filters,
    filtersReducer
  );

  // The model might not have filters (or an empty array of filters) in it because of the way it was built in previous versions of the datasource.
  // If this is the case we add a default one.
  useEffect(() => {
    if (!bucketAgg.settings?.filters?.length) {
      dispatch(addFilter());
    }
  }, [dispatch, bucketAgg.settings?.filters?.length]);

  return (
    <>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        {bucketAgg.settings?.filters!.map((filter, index) => (
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
              elements={bucketAgg.settings?.filters || []}
              onAdd={() => dispatch(addFilter())}
              onRemove={() => dispatch(removeFilter(index))}
            />
          </div>
        ))}
      </div>
    </>
  );
};
