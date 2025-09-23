import { FieldConfig, FieldType } from '@grafana/data';
import { AxisPlacement, GraphFieldConfig, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';

import { FIXED_UNIT } from './types';

/**
 * @internal -- not a public API
 */
export function buildScaleKey(config: FieldConfig<GraphFieldConfig>, fieldType: FieldType) {
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

  return `${scaleUnit}/${scaleRange}/${scaleSoftRange}/${scalePlacement}/${scaleDistribution}/${scaleLabel}/${fieldType}`;
}

function getScaleDistributionPart(config: ScaleDistributionConfig) {
  if (config.type === ScaleDistribution.Log) {
    return `${config.type}${config.log}`;
  }
  return config.type;
}
