import { RefObject } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';

import { ActionsMenu } from './ActionsMenu';
import { AssistantButton } from './AssistantButton';
import { InspectorButton } from './InspectorButton';
import { SaveButton } from './SaveButton';
import { WarningBadges } from './WarningBadges';

interface HeaderActionsProps {
  containerRef?: RefObject<HTMLDivElement>;
  queries: DataQuery[];
}

/**
 * Container for all action buttons in the query editor header.
 *
 * @remarks
 * Each child component is responsible for determining its own visibility
 * by reading cardType from QueryEditorUIContext. This keeps the logic
 * decentralized and each component self-contained.
 *
 * HeaderActions simply renders all components and lets them decide whether
 * to show or hide themselves based on context.
 */
export function HeaderActions({ containerRef, queries }: HeaderActionsProps) {
  return (
    <Stack gap={1} alignItems="center">
      <AssistantButton queries={queries} />
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <InspectorButton />
      <ActionsMenu app={CoreApp.PanelEditor} />
    </Stack>
  );
}
