/**
 * CollabPresence — toolbar wrapper for CollabPresenceBar.
 *
 * Adapts CollabPresenceBar to the ToolbarActionProps interface so it
 * can be rendered in the dashboard toolbar action list.
 */

import { CollabPresenceBar } from 'app/features/dashboard-collab/CollabPresenceBar';

import type { ToolbarActionProps } from '../types';

export function CollabPresence(_props: ToolbarActionProps) {
  return <CollabPresenceBar />;
}
