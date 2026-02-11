import { RefObject } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { ActionsMenu } from './ActionsMenu';
import { HideButton } from './HideButton';
import { PluginActions } from './PluginActions';
import { RemoveButton } from './RemoveButton';
import { SaveButton } from './SaveButton';
import { WarningBadges } from './WarningBadges';

interface HeaderActionsProps {
  containerRef?: RefObject<HTMLDivElement>;
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
export function HeaderActions({ containerRef }: HeaderActionsProps) {
  return (
    <Stack gap={1} alignItems="center">
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <PluginActions app={CoreApp.PanelEditor} />
      <HideButton />
      <RemoveButton />
      <ActionsMenu app={CoreApp.PanelEditor} />
    </Stack>
  );
}
