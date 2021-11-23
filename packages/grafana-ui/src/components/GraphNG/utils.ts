import { XYFieldMatchers } from './types';
import { ArrayVector, DataFrame, FieldConfig, FieldType, outerJoinDataFrames } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';
import { AxisPlacement, GraphFieldConfig, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';
import { FIXED_UNIT } from './GraphNG';

// will mutate the DataFrame's fields' values
function applySpanNullsThresholds(frame: DataFrame) {
  let refField = frame.fields.find((field) => field.type === FieldType.time); // this doesnt need to be time, just any numeric/asc join field
  let refValues = refField?.values.toArray() as any[];

  for (let i = 0; i < frame.fields.length; i++) {
    let field = frame.fields[i];

    if (field === refField) {
      continue;
    }

    if (field.type === FieldType.number) {
      let spanNulls = field.config.custom?.spanNulls;

      if (typeof spanNulls === 'number') {
        if (spanNulls !== -1) {
          field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
        }
      }
    }
  }

  return frame;
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers) {
  let alignedFrame = outerJoinDataFrames({
    frames: frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });

  return alignedFrame && applySpanNullsThresholds(alignedFrame);
}

export function buildScaleKey(config: FieldConfig<GraphFieldConfig>) {
  const defaultPart = 'na';

  const scaleRange = `${config.min !== undefined ? config.min : defaultPart}-${
    config.max !== undefined ? config.max : defaultPart
  }`;

  const scaleSoftRange = `${config.custom?.axisSoftMin !== undefined ? config.custom.axisSoftMin : defaultPart}-${
    config.custom?.axisSoftMax !== undefined ? config.custom.axisSoftMax : defaultPart
  }`;

  const scalePlacement = `${
    config.custom?.axisPlacement !== undefined ? config.custom?.axisPlacement : AxisPlacement.Auto
  }`;

  const scaleUnit = config.unit ?? FIXED_UNIT;

  const scaleDistribution = config.custom?.scaleDistribution
    ? getScaleDistributionPart(config.custom.scaleDistribution)
    : ScaleDistribution.Linear;

  const scaleLabel = Boolean(config.custom?.axisLabel) ? config.custom!.axisLabel : defaultPart;

  return `${scaleUnit}/${scaleRange}/${scaleSoftRange}/${scalePlacement}/${scaleDistribution}/${scaleLabel}`;
}

function getScaleDistributionPart(config: ScaleDistributionConfig) {
  if (config.type === ScaleDistribution.Log) {
    return `${config.type}${config.log}`;
  }
  return config.type;
}
