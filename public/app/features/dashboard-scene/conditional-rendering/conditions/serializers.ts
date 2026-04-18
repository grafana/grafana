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
