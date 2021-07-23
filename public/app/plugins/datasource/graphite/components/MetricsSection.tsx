import React, { useCallback } from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { SegmentAsync } from '@grafana/ui';
import { GraphiteQueryEditorState } from '../state/store';
import { getAltSegments } from '../state/providers';
import { actions } from '../state/actions';
import { SelectableValue } from '@grafana/data';

type Props = {
  dispatch: Dispatch;
  rawQuery: string;
  segments: GraphiteSegment[];
  state: GraphiteQueryEditorState;
};

function mapToSelectableValue(segment: GraphiteSegment): SelectableValue<GraphiteSegment> {
  return {
    label: segment.value,
    value: segment,
  };
}

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
      const segments = await getAltSegments(state, index, '');
      return segments.map(mapToSelectableValue);
    },
    [state]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {segments.map((segment, index) => {
        return (
          <SegmentAsync<GraphiteSegment>
            key={index}
            value={mapToSelectableValue(segment)}
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
