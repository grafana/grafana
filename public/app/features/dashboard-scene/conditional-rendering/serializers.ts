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

export interface ConditionalRenderingSerializer {
  deserialize(
    model:
      | ConditionalRenderingGroupKind
      | ConditionalRenderingVariableKind
      | ConditionalRenderingDataKind
      | ConditionalRenderingTimeIntervalKind
  ): ConditionalRenderingGroup | ConditionalRenderingVariable | ConditionalRenderingData | ConditionalRenderingInterval;
}

interface ConditionalRenderingSerializerRegistryItem extends RegistryItem {
  serializer: ConditionalRenderingSerializer;
}

export class ConditionalRenderingGroupSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingGroupKind): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({
      condition: model.spec.condition,
      value: model.spec.groups.map(
        (
          group:
            | ConditionalRenderingGroupKind
            | ConditionalRenderingVariableKind
            | ConditionalRenderingDataKind
            | ConditionalRenderingTimeIntervalKind
        ) => {
          const serializerRegistryItem = conditionalRenderingSerializerRegistry.getIfExists(group.kind);
          if (!serializerRegistryItem) {
            throw new Error(`No serializer found for conditional rendering kind: ${group.kind}`);
          }
          return serializerRegistryItem.serializer.deserialize(group);
        }
      ),
    });
  }
}

export class ConditionalRenderingVariableSerializer implements ConditionalRenderingSerializer {
  deserialize(model: ConditionalRenderingVariableKind): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({
      value: {
        name: model.spec.variable,
        operator: model.spec.operator,
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
