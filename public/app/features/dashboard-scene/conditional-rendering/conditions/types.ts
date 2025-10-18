import { type ConditionalRenderingData } from './ConditionalRenderingData';
import { type ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { type ConditionalRenderingVariable } from './ConditionalRenderingVariable';

export type ConditionalRenderingConditions =
  | ConditionalRenderingVariable
  | ConditionalRenderingData
  | ConditionalRenderingTimeRangeSize;
