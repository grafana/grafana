import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { Actions } from '../../Actions';
import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

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
 * Manages actions (hide, delete) for the currently selected query or transformation.
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

  const isHidden = selectedQuery?.hide || selectedTransformation?.transformConfig?.disabled || false;
  const typeLabel = QUERY_EDITOR_TYPE_CONFIG[cardType].getLabel();

  return (
    <Stack gap={1} alignItems="center">
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <PluginActions app={CoreApp.PanelEditor} />
      <Actions
        contentHeader={true}
        isHidden={isHidden}
        onDelete={onDelete}
        onToggleHide={onToggleHide}
        typeLabel={typeLabel}
      />
      <ActionsMenu app={CoreApp.PanelEditor} />
    </Stack>
  );
}
