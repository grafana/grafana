import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, SegmentAsync, useStyles2 } from '@grafana/ui';

import { GraphiteTag } from '../graphite_query';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
import { getTagsAsSegmentsSelectables } from '../state/providers';
import { GraphiteQueryEditorState } from '../state/store';
import { GraphiteSegment } from '../types';

import { PlayButton } from './PlayButton';
import { TagEditor } from './TagEditor';

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
  const debouncedGetTagsAsSegments = useMemo(
    () => debounce(getTagsAsSegmentsOptions, 200, { leading: true }),
    [getTagsAsSegmentsOptions]
  );

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
          Component={<Button icon="plus" variant="secondary" className={styles.button} aria-label="Add new tag" />}
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
