import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SegmentAsync } from '@grafana/ui';

import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
import { getAltSegmentsSelectables } from '../state/providers';
import { GraphiteQueryEditorState } from '../state/store';
import { GraphiteSegment } from '../types';

type Props = {
  segment: GraphiteSegment;
  metricIndex: number;
  state: GraphiteQueryEditorState;
};

/**
 * Represents a single metric node in the metric path at the given index. Allows to change the metric name to one of the
 * provided options or a custom value.
 *
 * Options for tag names and metric names are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 *
 * getAltSegmentsSelectables() also returns list of tags for segment with index=0. Once a tag is selected the editor
 * enters tag-adding mode (see SeriesSection and GraphiteQueryModel.seriesByTagUsed).
 */
export function MetricSegment({ metricIndex, segment, state }: Props) {
  const dispatch = useDispatch();
  const loadOptions = useCallback(
    (value: string | undefined) => {
      return getAltSegmentsSelectables(state, metricIndex, value || '');
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
    <SegmentAsync<GraphiteSegment | string>
      value={segment.value}
      inputMinWidth={150}
      allowCustomValue={true}
      loadOptions={debouncedLoadOptions}
      reloadOptionsOnChange={true}
      onChange={onSegmentChangedDebounced}
    />
  );
}
