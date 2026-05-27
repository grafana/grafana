import { Registry, type RegistryItem } from '@grafana/data';
import {
  type ConditionalRenderingDataKind,
  type ConditionalRenderingTimeRangeSizeKind,
  type ConditionalRenderingVariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { type ConditionalRenderingConditions } from './types';

export type ConditionalRenderingConditionsKindTypes =
  | ConditionalRenderingVariableKind
  | ConditionalRenderingDataKind
  | ConditionalRenderingTimeRangeSizeKind;

export interface ConditionalRenderingConditionsSerializerRegistryItem extends RegistryItem {
  deserialize(model: ConditionalRenderingConditionsKindTypes): ConditionalRenderingConditions;
}

export const conditionalRenderingSerializerRegistry =
  new Registry<ConditionalRenderingConditionsSerializerRegistryItem>(() => {
    return [
      ConditionalRenderingVariable.serializer,
      ConditionalRenderingData.serializer,
      ConditionalRenderingTimeRangeSize.serializer,
    ];
  });
