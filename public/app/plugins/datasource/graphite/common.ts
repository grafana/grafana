import { GraphiteQueryEditorState } from './state';
import { dispatch } from '../../../store/store';
import { notifyApp } from '../../../core/reducers/appNotification';
import { createErrorNotification } from '../../../core/copy/appNotification';

export const GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];
export const TAG_PREFIX = 'tag: ';

export function handleMetricsAutoCompleteError(
  state: GraphiteQueryEditorState,
  error: Error
): GraphiteQueryEditorState {
  console.error(error);
  if (!state._metricAutoCompleteErrorShown) {
    state._metricAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching metrics failed: ${error.message}.`)));
  }
  return state;
}

export function handleTagsAutoCompleteError(state: GraphiteQueryEditorState, error: Error): GraphiteQueryEditorState {
  console.error(error);
  if (!state._tagsAutoCompleteErrorShown) {
    state._tagsAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching tags failed: ${error.message}.`)));
  }
  return state;
}
