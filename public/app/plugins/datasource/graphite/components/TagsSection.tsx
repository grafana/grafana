import React, { useCallback, useMemo } from 'react';
import { GraphiteSegment } from '../types';
import { GraphiteTag } from '../graphite_query';
import { GraphiteQueryEditorState } from '../state/store';
import { getTagsAsSegmentsSelectables } from '../state/providers';
import { Button, SegmentAsync, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { TagEditor } from './TagEditor';
import { debounce } from 'lodash';
import { useDispatch } from '../state/context';
import { PlayButton } from './PlayButton';

type Props = {
  tags: GraphiteTag[];
  state: GraphiteQueryEditorState;
};

/**
 * Renders all tags and a button allowing to add more tags.
 *
 * Options for tag names are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 */
export function TagsSection({ tags, state }: Props) {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  // Options are reloaded while user is typing with backend taking care of auto-complete (auto-complete cannot be
  // implemented in front-end because backend returns only limited number of entries)
  const getTagsAsSegmentsOptions = useCallback(
    (inputValue?: string) => {
      return getTagsAsSegmentsSelectables(state, inputValue || '');
    },
    [state]
  );
  const debouncedGetTagsAsSegments = useMemo(() => debounce(getTagsAsSegmentsOptions, 200, { leading: true }), [
    getTagsAsSegmentsOptions,
  ]);

  return (
    <>
      {tags.map((tag, index) => {
        return <TagEditor key={index} tagIndex={index} tag={tag} state={state} />;
      })}
      {tags.length && (
        <SegmentAsync<GraphiteSegment>
          inputMinWidth={150}
          onChange={(value) => {
            dispatch(actions.addNewTag({ segment: value.value! }));
          }}
          loadOptions={debouncedGetTagsAsSegments}
          reloadOptionsOnChange={true}
          Component={<Button icon="plus" variant="secondary" className={styles.button} />}
        />
      )}
      {state.paused && <PlayButton />}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
