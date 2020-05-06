import { DataFrame, Field, FieldState, TIME_SERIES_FIELD_NAME, FieldType } from '../types';
import { formatLabels } from '../utils/labels';

/**
 * Get an appropriate display title
 */
export function getFrameDisplayTitle(frame: DataFrame, index?: number) {
  if (frame.name) {
    return frame.name;
  }

  // Single field with tags
  const valuesWithLabels = frame.fields.filter(f => f.labels !== undefined);
  if (valuesWithLabels.length === 1) {
    return formatLabels(valuesWithLabels[0].labels!);
  }

  // list all the
  if (index === undefined) {
    return frame.fields
      .filter(f => f.type !== FieldType.time)
      .map(f => getFieldState(f, frame).title)
      .join(', ');
  }

  if (frame.refId) {
    return `Series (${frame.refId})`;
  }

  return `Series (${index})`;
}

export function getFieldState(field: Field, frame?: DataFrame, allFrames?: DataFrame[]): FieldState {
  if (!field.state || !field.state.title) {
    field.state = calculateFieldState(field, frame, allFrames);
  }
  return field.state;
}

/**
 * Get an appropriate display title. If the 'title' is set, use that
 */
function calculateFieldState(field: Field, frame?: DataFrame, allFrames?: DataFrame[]): FieldState {
  const hasConfigTitle = field.config?.title && field.config?.title.length;

  let title = hasConfigTitle ? field.config!.title! : field.name;

  if (hasConfigTitle) {
    return {
      ...field.state,
      title,
    };
  }

  // This is an ugly exception for time field
  // For time series we should normally treat time field with same name
  // But in case it has a join source we should handle it as normal field
  if (field.type === FieldType.time && !field.labels) {
    return {
      ...field.state,
      title: title ?? 'Time',
    };
  }

  let parts: string[] = [];
  let frameNamesDiffer = false;

  if (allFrames && allFrames.length > 1) {
    for (let i = 1; i < allFrames.length; i++) {
      const frame = allFrames[i];
      if (frame.name !== allFrames[i - 1].name) {
        frameNamesDiffer = true;
        break;
      }
    }
  }

  let frameNameAdded = false;
  let labelsAdded = false;

  if (frameNamesDiffer && frame?.name) {
    parts.push(frame.name);
    frameNameAdded = true;
  }

  if (field.name && field.name !== TIME_SERIES_FIELD_NAME) {
    parts.push(field.name);
  }

  if (field.labels && frame) {
    let singleLabelName = getSingleLabelName(allFrames ?? [frame]);

    if (!singleLabelName) {
      let allLabels = formatLabels(field.labels);
      if (allLabels) {
        parts.push(allLabels);
        labelsAdded = true;
      }
    } else if (field.labels[singleLabelName]) {
      parts.push(field.labels[singleLabelName]);
      labelsAdded = true;
    }
  }

  // if we have not added frame name and no labels, and field name = Value, we should add frame name
  if (frame && !frameNameAdded && !labelsAdded && field.name === TIME_SERIES_FIELD_NAME) {
    if (frame.name && frame.name.length > 0) {
      parts.push(frame.name);
      frameNameAdded = true;
    }
  }

  if (parts.length) {
    title = parts.join(' ');
  } else if (field.name) {
    title = field.name;
  } else {
    title = TIME_SERIES_FIELD_NAME;
  }

  return {
    ...field.state,
    title,
  };
}

/**
 * Checks all data frames and return name of label if there is only one label name in all frames
 */
function getSingleLabelName(frames: DataFrame[]): string | null {
  let singleName: string | null = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    for (const field of frame.fields) {
      if (!field.labels) {
        continue;
      }

      // yes this should be in!
      for (const labelKey in field.labels) {
        if (singleName === null) {
          singleName = labelKey;
        } else if (labelKey !== singleName) {
          return null;
        }
      }
    }
  }

  return singleName;
}
