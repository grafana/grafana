import { Registry } from '@grafana/data';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionalRenderingScopes } from './ConditionalRenderingScopes';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { ConditionalRenderingSerializerRegistryItem } from './types';

export const conditionalRenderingSerializerRegistry = new Registry<ConditionalRenderingSerializerRegistryItem>(() => {
  return [
    ConditionalRenderingGroup.serializer,
    ConditionalRenderingVariable.serializer,
    ConditionalRenderingData.serializer,
    ConditionalRenderingTimeRangeSize.serializer,
    ConditionalRenderingScopes.serializer,
  ];
});
