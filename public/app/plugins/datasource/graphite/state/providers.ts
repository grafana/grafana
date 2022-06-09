import { eachRight, map, remove } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { mapSegmentsToSelectables, mapStringsToSelectables } from '../components/helpers';
import { GraphiteSegment, GraphiteTag, GraphiteTagOperator } from '../types';

import {
  TAG_PREFIX,
  GRAPHITE_TAG_OPERATORS,
  handleMetricsAutoCompleteError,
  handleTagsAutoCompleteError,
} from './helpers';
import { GraphiteQueryEditorState } from './store';

/**
 * All auto-complete lists are updated while typing. To avoid performance issues we do not render more
 * than MAX_SUGGESTIONS limits in a single dropdown.
 *
 * MAX_SUGGESTIONS is per metrics and tags separately. On the very first dropdown where metrics and tags are
 * combined together meaning it may end up with max of 2 * MAX_SUGGESTIONS items in total.
 */
const MAX_SUGGESTIONS = 5000;

/**
 * Providers are hooks for views to provide temporal data for autocomplete. They don't modify the state.
 */

/**
 * Return list of available options for a segment with given index
 *
 * It may be:
 * - mixed list of metrics and tags (only when nothing was selected)
 * - list of metric names (if a metric name was selected for this segment)
 */
async function getAltSegments(
  state: GraphiteQueryEditorState,
  index: number,
  prefix: string
): Promise<GraphiteSegment[]> {
  let query = prefix.length > 0 ? '*' + prefix + '*' : '*';
  if (index > 0) {
    query = state.queryModel.getSegmentPathUpTo(index) + '.' + query;
  }
  const options = {
    range: state.range,
    requestId: 'get-alt-segments',
  };

  try {
    const segments = await state.datasource.metricFindQuery(query, options);
    const altSegments: GraphiteSegment[] = map(segments, (segment) => {
      return {
        value: segment.text,
        expandable: segment.expandable,
      };
    });

    if (index > 0 && altSegments.length === 0) {
      return altSegments;
    }

    // add query references
    if (index === 0) {
      eachRight(state.queries, (target) => {
        if (target.refId === state.queryModel.target.refId) {
          return;
        }

        altSegments.unshift({
          type: 'series-ref',
          value: '#' + target.refId,
          expandable: false,
        });
      });
    }

    // add template variables
    eachRight(state.templateSrv.getVariables(), (variable) => {
      altSegments.unshift({
        type: 'template',
        value: '$' + variable.name,
        expandable: true,
      });
    });

    // add wildcard option and limit number of suggestions (API doesn't support limiting
    // hence we are doing it here)
    altSegments.unshift({ value: '*', expandable: true });
    altSegments.splice(MAX_SUGGESTIONS);

    if (state.supportsTags && index === 0) {
      removeTaggedEntry(altSegments);
      return await addAltTagSegments(state, prefix, altSegments);
    } else {
      return altSegments;
    }
  } catch (err) {
    if (err instanceof Error) {
      handleMetricsAutoCompleteError(state, err);
    }
  }

  return [];
}

/**
 * Get the list of segments with tags and metrics. Suggestions are reduced in getAltSegments and addAltTagSegments so in case
 * we hit MAX_SUGGESTIONS limit there are always some tags and metrics shown.
 */
export async function getAltSegmentsSelectables(
  state: GraphiteQueryEditorState,
  index: number,
  prefix: string
): Promise<Array<SelectableValue<GraphiteSegment>>> {
  return mapSegmentsToSelectables(await getAltSegments(state, index, prefix));
}

export function getTagOperatorsSelectables(): Array<SelectableValue<GraphiteTagOperator>> {
  return mapStringsToSelectables(GRAPHITE_TAG_OPERATORS);
}

/**
 * Returns tags as dropdown options
 */
async function getTags(state: GraphiteQueryEditorState, index: number, tagPrefix: string): Promise<string[]> {
  try {
    const tagExpressions = state.queryModel.renderTagExpressions(index);
    const values = await state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix, {
      range: state.range,
      limit: MAX_SUGGESTIONS,
    });

    const altTags = map(values, 'text');
    altTags.splice(0, 0, state.removeTagValue);
    return altTags;
  } catch (err) {
    if (err instanceof Error) {
      handleTagsAutoCompleteError(state, err);
    }
  }

  return [];
}

export async function getTagsSelectables(
  state: GraphiteQueryEditorState,
  index: number,
  tagPrefix: string
): Promise<Array<SelectableValue<string>>> {
  return mapStringsToSelectables(await getTags(state, index, tagPrefix));
}

/**
 * List of tags when a tag is added. getTags is used for editing.
 * When adding - segment is used. When editing - dropdown is used.
 */
async function getTagsAsSegments(state: GraphiteQueryEditorState, tagPrefix: string): Promise<GraphiteSegment[]> {
  let tagsAsSegments: GraphiteSegment[];
  try {
    const tagExpressions = state.queryModel.renderTagExpressions();
    const values = await state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix, {
      range: state.range,
      limit: MAX_SUGGESTIONS,
    });
    tagsAsSegments = map(values, (val) => {
      return {
        value: val.text,
        type: 'tag',
        expandable: false,
      };
    });
  } catch (err) {
    tagsAsSegments = [];
    if (err instanceof Error) {
      handleTagsAutoCompleteError(state, err);
    }
  }

  return tagsAsSegments;
}

/**
 * Get list of tags, used when adding additional tags (first tag is selected from a joined list of metrics and tags)
 */
export async function getTagsAsSegmentsSelectables(
  state: GraphiteQueryEditorState,
  tagPrefix: string
): Promise<Array<SelectableValue<GraphiteSegment>>> {
  return mapSegmentsToSelectables(await getTagsAsSegments(state, tagPrefix));
}

async function getTagValues(
  state: GraphiteQueryEditorState,
  tag: GraphiteTag,
  index: number,
  valuePrefix: string
): Promise<string[]> {
  const tagExpressions = state.queryModel.renderTagExpressions(index);
  const tagKey = tag.key;
  const values = await state.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix, {
    limit: MAX_SUGGESTIONS,
  });
  const altValues = map(values, 'text');
  // Add template variables as additional values
  eachRight(state.templateSrv.getVariables(), (variable) => {
    altValues.push('${' + variable.name + ':regex}');
  });

  return altValues;
}

export async function getTagValuesSelectables(
  state: GraphiteQueryEditorState,
  tag: GraphiteTag,
  index: number,
  valuePrefix: string
): Promise<Array<SelectableValue<string>>> {
  return mapStringsToSelectables(await getTagValues(state, tag, index, valuePrefix));
}

/**
 * Add segments with tags prefixed with "tag: " to include them in the same list as metrics
 */
async function addAltTagSegments(
  state: GraphiteQueryEditorState,
  prefix: string,
  altSegments: GraphiteSegment[]
): Promise<GraphiteSegment[]> {
  let tagSegments = await getTagsAsSegments(state, prefix);

  tagSegments = map(tagSegments, (segment) => {
    segment.value = TAG_PREFIX + segment.value;
    return segment;
  });

  return altSegments.concat(...tagSegments);
}

function removeTaggedEntry(altSegments: GraphiteSegment[]) {
  remove(altSegments, (s) => s.value === '_tagged');
}
