import { type EventProperty } from '@grafana/runtime/unstable';

export interface StylesToggled extends EventProperty {
  /** Whether the user applied the new styles (true) or reverted to the old ones (false). */
  value: boolean;
}
