import { InlineField, Input } from '@grafana/ui';
import { css } from 'emotion';
import React, { FunctionComponent } from 'react';
import { AddRemove } from '../../../AddRemove';
import { useDispatch, useStatelessReducer } from '../../../../hooks/useStatelessReducer';
import { Filters } from '../../aggregations';
import { changeBucketAggregationSetting } from '../../state/actions';
import { BucketAggregationAction } from '../../state/types';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';
import { defaultFilter } from './utils';

interface Props {
  value: Filters;
}

export const FiltersSettingsEditor: FunctionComponent<Props> = ({ value }) => {
  const upperStateDispatch = useDispatch<BucketAggregationAction<Filters>>();

  const dispatch = useStatelessReducer(
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
        {/* FIXME: Check if this default is really needed */}
        {(value.settings?.filters || [defaultFilter()]).map((filter, index) => (
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
                <Input
                  /* FIXME: QueryField was causing some issues, need to investigate.  */
                  placeholder="Lucene Query"
                  onBlur={e => dispatch(changeFilter(index, { ...filter, query: e.target.value! }))}
                  defaultValue={filter.query}
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
        ))}
      </div>
    </>
  );
};
