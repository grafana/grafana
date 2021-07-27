import React, { useCallback } from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { SegmentAsync } from '@grafana/ui';
import { GraphiteQueryEditorState } from '../state/store';
import { getAltSegments } from '../state/providers';
import { actions } from '../state/actions';
import { SelectableValue } from '@grafana/data';
import { mapSegmentsToSelectables } from './helpers';

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
    async (index: number) => {
      return mapSegmentsToSelectables(await getAltSegments(state, index, ''));
    },
    [state]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {segments.map((segment, index) => {
        return (
          <SegmentAsync<GraphiteSegment>
            key={index}
            value={{ label: segment.value, value: segment }}
            inputMinWidth={150}
            allowCustomValue={true}
            loadOptions={async () => await loadOptions(index)}
            onChange={(value) => {
              let selectedSegment = mapFromSelectableValue(value);
              dispatch(actions.segmentValueChanged({ segment: selectedSegment, index }));
            }}
          />
        );
      })}
    </div>
  );
}
