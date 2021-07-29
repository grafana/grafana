import React, { useCallback, useMemo } from 'react';
import { Dispatch } from 'redux';
import { Segment, SegmentAsync } from '@grafana/ui';
import { actions } from '../state/actions';
import { GraphiteTag, GraphiteTagOperator } from '../types';
import { mapStringsToSelectables } from './helpers';
import { getTagOperators, getTags, getTagValues } from '../state/providers';
import { GraphiteQueryEditorState } from '../state/store';
import { debounce } from 'lodash';

type Props = {
  tag: GraphiteTag;
  tagIndex: number;
  dispatch: Dispatch;
  state: GraphiteQueryEditorState;
};

export function TagEditor({ dispatch, tag, tagIndex, state }: Props) {
  const getTagsOptions = useCallback(
    async (inputValue: string | undefined) => {
      return mapStringsToSelectables(await getTags(state, tagIndex, inputValue || ''));
    },
    [state, tagIndex]
  );
  const debouncedGetTagsOptions = useMemo(() => debounce(getTagsOptions, 200, { leading: true }), [getTagsOptions]);

  const getTagValueOptions = useCallback(
    async (inputValue: string | undefined) => {
      return mapStringsToSelectables(await getTagValues(state, tag, tagIndex, inputValue || ''));
    },
    [state, tagIndex, tag]
  );
  const debouncedGetTagValueOptions = useMemo(() => debounce(getTagValueOptions, 200, { leading: true }), [
    getTagValueOptions,
  ]);

  return (
    <>
      <SegmentAsync
        inputMinWidth={150}
        value={tag.key}
        loadOptions={debouncedGetTagsOptions}
        reloadOptionsOnChange={true}
        onChange={(value) => {
          dispatch(
            actions.tagChanged({
              tag: { ...tag, key: value.value! },
              index: tagIndex,
            })
          );
        }}
        allowCustomValue={true}
      />
      <Segment<GraphiteTagOperator>
        inputMinWidth={50}
        value={tag.operator}
        options={mapStringsToSelectables(getTagOperators())}
        onChange={(value) => {
          dispatch(
            actions.tagChanged({
              tag: { ...tag, operator: value.value! },
              index: tagIndex,
            })
          );
        }}
      />
      <SegmentAsync
        inputMinWidth={150}
        value={tag.value}
        loadOptions={debouncedGetTagValueOptions}
        reloadOptionsOnChange={true}
        onChange={(value) => {
          dispatch(
            actions.tagChanged({
              tag: { ...tag, value: value.value! },
              index: tagIndex,
            })
          );
        }}
        allowCustomValue={true}
      />
    </>
  );
}
