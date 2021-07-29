import React, { useCallback, useMemo } from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { GraphiteTag } from '../graphite_query';
import { GraphiteQueryEditorState } from '../state/store';
import { getTagsAsSegmentsSelectables } from '../state/providers';
import { Button, SegmentAsync, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { mapSegmentsToSelectables } from './helpers';
import { TagEditor } from './TagEditor';
import { debounce } from 'lodash';

type Props = {
  dispatch: Dispatch;
  tags: GraphiteTag[];
  addTagSegments: GraphiteSegment[];
  state: GraphiteQueryEditorState;
};

export function TagsSection({ dispatch, tags, state, addTagSegments }: Props) {
  const styles = useStyles2(getStyles);

  const newTagsOptions = mapSegmentsToSelectables(addTagSegments || []);

  const getTagsAsSegmentsOptions = useCallback(
    async (inputValue: string) => {
      return await getTagsAsSegmentsSelectables(state, inputValue);
    },
    [state]
  );
  const debouncedGetTagsAsSegments = useMemo(() => debounce(getTagsAsSegmentsOptions, 200, { leading: true }), [
    getTagsAsSegmentsOptions,
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {tags.map((tag, index) => {
        return <TagEditor key={index} tagIndex={index} tag={tag} dispatch={dispatch} state={state} />;
      })}
      {newTagsOptions.length && (
        <SegmentAsync<GraphiteSegment>
          inputMinWidth={150}
          onChange={(value) => {
            dispatch(actions.addNewTag({ segment: value.value! }));
          }}
          loadOptions={debouncedGetTagsAsSegments}
          reloadOptionsOnChange={true}
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
