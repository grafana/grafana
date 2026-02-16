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
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingUserTeam } from './ConditionalRenderingUserTeam';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { conditionRegistry } from './conditionRegistry';

// Re-export the kind types union from conditionRegistry for backward compatibility.
export type { ConditionalRenderingConditionsKindTypes } from './conditionRegistry';

// Initialize the condition registry with the built-in condition types.
// New condition types can be registered elsewhere via conditionRegistry.register().
conditionRegistry.setInit(() => [
  ConditionalRenderingVariable.registryItem,
  ConditionalRenderingData.registryItem,
  ConditionalRenderingTimeRangeSize.registryItem,
  ConditionalRenderingUserTeam.registryItem,
]);
