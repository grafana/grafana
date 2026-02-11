import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { Actions } from '../Sidebar/Actions';

import { ActionsMenu } from './ActionsMenu';
import { PluginActions } from './PluginActions';
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
  const { selectedQuery, selectedTransformation } = useQueryEditorUIContext();
  const { toggleQueryHide, toggleTransformationDisabled, deleteQuery, deleteTransformation } = useActionsContext();

  const onToggleHide = useCallback(() => {
    if (selectedQuery) {
      toggleQueryHide(selectedQuery.refId);
    } else if (selectedTransformation) {
      toggleTransformationDisabled(selectedTransformation.transformId);
    }
  }, [selectedQuery, selectedTransformation, toggleQueryHide, toggleTransformationDisabled]);

  const onDelete = useCallback(() => {
    if (selectedQuery) {
      deleteQuery(selectedQuery.refId);
    } else if (selectedTransformation) {
      deleteTransformation(selectedTransformation.transformId);
    }
  }, [selectedQuery, selectedTransformation, deleteQuery, deleteTransformation]);

  const isHidden = selectedQuery?.hide || selectedTransformation?.transformConfig?.disabled || false;

  return (
    <Stack gap={1} alignItems="center">
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <PluginActions app={CoreApp.PanelEditor} />
      <Actions contentHeader={true} onToggleHide={onToggleHide} onDelete={onDelete} isHidden={isHidden} />
      <ActionsMenu app={CoreApp.PanelEditor} />
    </Stack>
  );
}
