import React, { useCallback, useMemo } from 'react';
import { SegmentAsync } from '@grafana/ui';
import { actions } from '../state/actions';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { SelectableValue } from '@grafana/data';
import { getAltSegmentsSelectables } from '../state/providers';
import { debounce } from 'lodash';
import { GraphiteQueryEditorState } from '../state/store';

type Props = {
  segment: GraphiteSegment;
  metricIndex: number;
  dispatch: Dispatch;
  state: GraphiteQueryEditorState;
};

export function MetricSegment({ dispatch, metricIndex, segment, state }: Props) {
  const loadOptions = useCallback(
    async (value: string | undefined) => {
      return await getAltSegmentsSelectables(state, metricIndex, value || '');
    },
    [state, metricIndex]
  );
  const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 200, { leading: true }), [loadOptions]);

  const onSegmentChanged = useCallback(
    (selectableValue: SelectableValue<GraphiteSegment | string>) => {
      // selectableValue.value is always defined because emptyValues are not allowed in SegmentAsync by default
      dispatch(actions.segmentValueChanged({ segment: selectableValue.value!, index: metricIndex }));
    },
    [dispatch, metricIndex]
  );

  // segmentValueChanged action will destroy SegmentAsync immediately if a tag is selected. To give time
  // for the clean up the action is debounced.
  const onSegmentChangedDebounced = useMemo(() => debounce(onSegmentChanged, 100), [onSegmentChanged]);

  return (
    <SegmentAsync<GraphiteSegment>
      value={{ label: segment.value, value: segment }}
      inputMinWidth={150}
      allowCustomValue={true}
      loadOptions={debouncedLoadOptions}
      reloadOptionsOnChange={true}
      onChange={onSegmentChangedDebounced}
    />
  );
}
