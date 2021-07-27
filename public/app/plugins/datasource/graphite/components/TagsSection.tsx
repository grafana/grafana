import React, { useCallback } from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment, GraphiteTagOperator } from '../types';
import { GraphiteTag } from '../graphite_query';
import { GraphiteQueryEditorState } from '../state/store';
import { getTagOperators, getTags, getTagsAsSegments, getTagValues } from '../state/providers';
import { Button, Segment, SegmentAsync, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { mapSegmentsToSelectables, mapStringsToSelectables } from './helpers';

type Props = {
  dispatch: Dispatch;
  tags: GraphiteTag[];
  addTagSegments: GraphiteSegment[];
  state: GraphiteQueryEditorState;
};

export function TagsSection({ dispatch, tags, state, addTagSegments }: Props) {
  const styles = useStyles2(getStyles);

  const getTagsOptions = useCallback(
    async (index) => {
      return mapStringsToSelectables(await getTags(state, index, ''));
    },
    [state]
  );

  const getTagValueOptions = useCallback(
    async (tag: GraphiteTag, index: number) => {
      return mapStringsToSelectables(await getTagValues(state, tag, index, ''));
    },
    [state]
  );

  const newTagsOptions = mapSegmentsToSelectables(addTagSegments);

  const getTagsAsSegmentsOptions = useCallback(async () => {
    return mapSegmentsToSelectables(await getTagsAsSegments(state, ''));
  }, [state]);

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {tags.map((tag, index) => {
        return (
          <React.Fragment key={index}>
            <SegmentAsync
              inputMinWidth={150}
              value={tag.key}
              loadOptions={async () => await getTagsOptions(index)}
              onChange={(value) => {
                dispatch(
                  actions.tagChanged({
                    tag: { ...tag, key: value.value! },
                    index,
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
                    index,
                  })
                );
              }}
            />
            <SegmentAsync
              inputMinWidth={150}
              value={tag.value}
              loadOptions={async () => await getTagValueOptions(tag, index)}
              onChange={(value) => {
                dispatch(
                  actions.tagChanged({
                    tag: { ...tag, value: value.value! },
                    index,
                  })
                );
              }}
              allowCustomValue={true}
            />
          </React.Fragment>
        );
      })}
      {newTagsOptions.length && (
        <SegmentAsync<GraphiteSegment>
          onChange={(value) => {
            dispatch(actions.addNewTag({ segment: value.value! }));
          }}
          loadOptions={getTagsAsSegmentsOptions}
          Component={<Button icon="plus" variant="secondary" className={cx(styles.button)} />}
        />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
