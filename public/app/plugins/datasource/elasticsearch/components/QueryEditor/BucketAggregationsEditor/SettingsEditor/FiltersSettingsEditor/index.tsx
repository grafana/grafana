import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { useEffect, useRef } from 'react';

import { InlineField, Input, QueryField } from '@grafana/ui';
import { Filters } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

import { useDispatch, useStatelessReducer } from '../../../../../hooks/useStatelessReducer';
import { AddRemove } from '../../../../AddRemove';
import { changeBucketAggregationSetting } from '../../state/actions';

import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';

interface Props {
  bucketAgg: Filters;
}

export const FiltersSettingsEditor = ({ bucketAgg }: Props) => {
  const { current: baseId } = useRef(uniqueId('es-filters-'));

  const upperStateDispatch = useDispatch();

  const dispatch = useStatelessReducer(
    (newValue) => upperStateDispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'filters', newValue })),
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
        className={css({
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {bucketAgg.settings?.filters!.map((filter, index) => (
          <div
            key={index}
            className={css({
              display: 'flex',
            })}
          >
            <InlineField label="Query" labelWidth={8}>
              <div
                className={css({
                  width: '150px',
                })}
              >
                <QueryField
                  placeholder="Lucene Query"
                  portalOrigin="elasticsearch"
                  onChange={(query) => dispatch(changeFilter({ index, filter: { ...filter, query } }))}
                  query={filter.query}
                />
              </div>
            </InlineField>
            <InlineField label="Label" labelWidth={8}>
              <Input
                width={16}
                id={`${baseId}-label-${index}`}
                placeholder="Label"
                onBlur={(e) => dispatch(changeFilter({ index, filter: { ...filter, label: e.target.value } }))}
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
