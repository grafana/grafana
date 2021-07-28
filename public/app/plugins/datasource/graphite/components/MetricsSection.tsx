import React, { useCallback } from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { SegmentAsync } from '@grafana/ui';
import { GraphiteQueryEditorState } from '../state/store';
import { getAltSegments } from '../state/providers';
import { actions } from '../state/actions';
import { SelectableValue } from '@grafana/data';
import { mapSegmentsToSelectables } from './helpers';
import { debounce } from 'lodash';

type Props = {
  dispatch: Dispatch;
  rawQuery: string;
  segments: GraphiteSegment[];
  state: GraphiteQueryEditorState;
};

/**
 * Mapping is required to convert custom item (provided as strings) to a GraphiteSegment object
 * @param selectableValue
 */
function mapFromSelectableValue(selectableValue: SelectableValue<GraphiteSegment | string>): GraphiteSegment {
  if (typeof selectableValue.value === 'string') {
    return {
      value: selectableValue.value,
      expandable: true,
      fake: false,
    };
  } else {
    return selectableValue.value!; // empty values are not allowed
  }
}

export function MetricsSection({ dispatch, segments = [], state }: Props) {
  const loadOptions = useCallback(
    async (index: number, value: string) => {
      return mapSegmentsToSelectables(await getAltSegments(state, index, value));
    },
    [state]
  );

  const onSegmentChanged = debounce((value: SelectableValue<GraphiteSegment | string>, index: number) => {
    let selectedSegment = mapFromSelectableValue(value);
    dispatch(actions.segmentValueChanged({ segment: selectedSegment, index }));
  }, 150);

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {segments.map((segment, index) => {
        return (
          <SegmentAsync<GraphiteSegment>
            key={index}
            value={{ label: segment.value, value: segment }}
            inputMinWidth={150}
            allowCustomValue={true}
            loadOptions={async (value) => await loadOptions(index, value || '')}
            reloadOptionsOnChange={true}
            onChange={(value: SelectableValue<GraphiteSegment | string>) => onSegmentChanged(value, index)}
          />
        );
      })}
    </div>
  );
}
