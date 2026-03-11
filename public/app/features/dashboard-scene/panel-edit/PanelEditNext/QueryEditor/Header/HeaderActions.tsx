import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { Actions } from '../../Actions';
import { QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { PluginActions } from './PluginActions';
import { QueryActionsMenu } from './QueryActionsMenu';
import { SaveButton } from './SaveButton';
import { TransformationActionButtons } from './TransformationActionButtons';
import { WarningBadges } from './WarningBadges';

interface HeaderActionsProps {
  containerRef?: RefObject<HTMLDivElement>;
}

/**
 * Container for all action buttons in the query editor header.
 *
 * @remarks
 * Manages actions (hide, delete) for the currently selected query or transformation.
 * Delete confirmation behavior is configured per type in QUERY_EDITOR_TYPE_CONFIG and
 * handled by the Actions component.
 * Child components like WarningBadges, SaveButton, and ActionsMenu determine their
 * own visibility by reading from QueryEditorUIContext.
 */
export function HeaderActions({ containerRef }: HeaderActionsProps) {
  const { selectedQuery, selectedTransformation, cardType } = useQueryEditorUIContext();
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

  const itemName =
    selectedQuery?.refId ?? selectedTransformation?.registryItem?.name ?? selectedTransformation?.transformId ?? '';

  const item = {
    name: itemName,
    type: cardType,
    isHidden: selectedQuery?.hide || selectedTransformation?.transformConfig?.disabled || false,
  };

  if (cardType === QueryEditorType.Alert) {
    return null;
  }

  return (
    <Stack gap={1} alignItems="center">
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <PluginActions app={CoreApp.PanelEditor} />
      <Actions contentHeader={true} item={item} onDelete={onDelete} onToggleHide={onToggleHide} />
      {cardType === QueryEditorType.Transformation ? <TransformationActionButtons /> : <QueryActionsMenu />}
    </Stack>
  );
}
