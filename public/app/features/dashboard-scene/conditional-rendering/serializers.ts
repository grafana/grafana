import { Registry, RegistryItem } from '@grafana/data';
import {
  ConditionalRenderingGroupKind,
  ConditionalRenderingVariableKind,
  ConditionalRenderingDataKind,
  ConditionalRenderingTimeIntervalKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionalRenderingInterval } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

export type ConditionalRenderingKindTypes =
  | ConditionalRenderingGroupKind
  | ConditionalRenderingVariableKind
  | ConditionalRenderingDataKind
  | ConditionalRenderingTimeIntervalKind;

export interface ConditionalRenderingSerializer {
  deserialize(
    model: ConditionalRenderingKindTypes
  ): ConditionalRenderingGroup | ConditionalRenderingVariable | ConditionalRenderingData | ConditionalRenderingInterval;
}

interface ConditionalRenderingSerializerRegistryItem extends RegistryItem {
  serializer: ConditionalRenderingSerializer;
}

export class ConditionalRenderingGroupSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingGroupKind): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({
      condition: model.spec.condition,
      value: model.spec.items.map((item: ConditionalRenderingKindTypes) => {
        const serializerRegistryItem = conditionalRenderingSerializerRegistry.getIfExists(item.kind);
        if (!serializerRegistryItem) {
          throw new Error(`No serializer found for conditional rendering kind: ${item.kind}`);
        }
        return serializerRegistryItem.serializer.deserialize(item);
      }),
    });
  }
}

export class ConditionalRenderingVariableSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingVariableKind): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({
      value: {
        name: model.spec.variable,
        operator: model.spec.operator === 'equals' ? '=' : '!=',
        value: model.spec.value,
      },
    });
  }
}

export class ConditionalRenderingDataSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingDataKind): ConditionalRenderingData {
    return new ConditionalRenderingData({
      value: model.spec.value,
    });
  }
}

export class ConditionalRenderingIntervalSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingTimeIntervalKind): ConditionalRenderingInterval {
    return new ConditionalRenderingInterval({
      value: model.spec.value,
    });
  }
}

export const conditionalRenderingSerializerRegistry = new Registry<ConditionalRenderingSerializerRegistryItem>(() => {
  return [
    {
      id: 'ConditionalRenderingGroup',
      name: 'Group',
      serializer: new ConditionalRenderingGroupSerializer(),
    },
    {
      id: 'ConditionalRenderingVariable',
      name: 'Variable',
      serializer: new ConditionalRenderingVariableSerializer(),
    },
    {
      id: 'ConditionalRenderingData',
      name: 'Data',
      serializer: new ConditionalRenderingDataSerializer(),
    },
    {
      id: 'ConditionalRenderingTimeInterval',
      name: 'Time Interval',
      serializer: new ConditionalRenderingIntervalSerializer(),
    },
  ];
});
