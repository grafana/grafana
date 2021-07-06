import { GraphiteQueryEditorState } from './state';
import { dispatch } from '../../../store/store';
import { notifyApp } from '../../../core/reducers/appNotification';
import { createErrorNotification } from '../../../core/copy/appNotification';

export const GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];

/**
 * Tag names and metric names are displayed in a single dropdown. This prefix is used to
 * distinguish both in the UI.
 */
export const TAG_PREFIX = 'tag: ';

/**
 * When metrics autocomplete fails - the error is shown, by only once per page view
 */
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

/**
 * When tags autocomplete fails - the error is shown, but only once per page view
 */
export function handleTagsAutoCompleteError(state: GraphiteQueryEditorState, error: Error): GraphiteQueryEditorState {
  console.error(error);
  if (!state._tagsAutoCompleteErrorShown) {
    state._tagsAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching tags failed: ${error.message}.`)));
  }
  return state;
}
