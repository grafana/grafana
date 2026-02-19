import { Registry, RegistryItem } from '@grafana/data';
import {
  ConditionalRenderingDataKind,
  ConditionalRenderingTimeRangeSizeKind,
  ConditionalRenderingVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { ConditionalRenderingConditions } from './types';

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
