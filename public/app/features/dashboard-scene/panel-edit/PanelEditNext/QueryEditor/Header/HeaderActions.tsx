import { type RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { Actions } from '../../Actions';
import { ConfirmationStyle } from '../../DeleteConfirm';
import { queryToActionItem, transformationToActionItem } from '../../actionItem';
import { QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { ExperimentalFeedbackButton } from './ExperimentalFeedbackButton';
import { PluginActions } from './PluginActions';
import { QueryActionsMenu } from './QueryActionsMenu';
import { SaveButton } from './SaveButton';
import { TransformationActionButtons } from './TransformationActionButtons';
import { WarningBadges } from './WarningBadges';

interface HeaderActionsProps {
  containerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Container for all action buttons in the query editor header.
 *
 * @remarks
 * Manages actions (hide, delete) for the currently selected query or transformation.
 * Delete confirmation behavior is configured per type in getQueryEditorTypeConfig and
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

  if (cardType === QueryEditorType.Alert) {
    return null;
  }

  const item = selectedQuery
    ? queryToActionItem(selectedQuery, { type: cardType })
    : selectedTransformation
      ? transformationToActionItem(selectedTransformation)
      : null;

  if (!item) {
    return null;
  }

  return (
    <Stack gap={1} alignItems="center">
      <WarningBadges />
      <SaveButton parentRef={containerRef} />
      <PluginActions app={CoreApp.PanelEditor} />
      <Actions
        contentHeader={true}
        confirmStyle={ConfirmationStyle.full}
        item={item}
        onDelete={onDelete}
        onToggleHide={onToggleHide}
        order={{
          delete: 2,
          hide: 1,
          duplicate: 0,
        }}
      />
      <ExperimentalFeedbackButton />
      {cardType === QueryEditorType.Transformation ? <TransformationActionButtons /> : <QueryActionsMenu />}
    </Stack>
  );
}
