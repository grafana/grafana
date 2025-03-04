import { createEventFactory as cef, TrackingEventProps } from '../../../services/echo/Echo';

/**
 * Testing file for developing the analytics report. It tests:
 *  - it can track an aliased import
 *  - it works with a relative import
 *  - it can track multiple namespaces in the same file
 */

const createFeatureA = cef('grafana', 'feature_a');
const createFeatureB = cef('grafana', 'feature_b');

type JustOneMember = 'foo';
type UnifiedHistoryDrawerActions = 'open' | 'close';

interface UnifiedHistoryDrawerInteraction extends TrackingEventProps {
  justOneMember: JustOneMember;
  aliasdUnionOfStrings: UnifiedHistoryDrawerActions;
  directUnionOfStrings: 'foo' | 'bar';
}

/**
 * Handle clicks on feature A
 *
 * @owner Frontend platform
 * */
export const logFoo = createFeatureA<UnifiedHistoryDrawerInteraction>('click_A');

type StringThatHasBeenAliased = string;

interface UnifiedHistoryEntryDuplicated extends TrackingEventProps {
  // URL of the last entry
  lastEntryURL: string;
  // URL of the new entry
  usesStringAlias: StringThatHasBeenAliased;
}

/** Handle clicks on feature B */
export const logBar = createFeatureB<UnifiedHistoryEntryDuplicated>('click_B');

/**
 * Handle clicks on feature B2
 * */
export const logBaz = createFeatureB<{
  inlineProp: string;
}>('click_B2');
