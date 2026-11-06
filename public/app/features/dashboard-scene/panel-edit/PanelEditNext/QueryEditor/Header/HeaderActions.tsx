import { type RefObject } from 'react';

import { CoreApp } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { Actions } from '../../Actions';
import { ConfirmationStyle } from '../../DeleteConfirm';
import { queryToActionItem, transformationToActionItem } from '../../actionItem';
import { QueryEditorType } from '../../constants';
import { type CardActionSource } from '../../tracking';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { ExperimentalFeedbackButton } from './ExperimentalFeedbackButton';
import { PluginActions } from './PluginActions';
import { QueryActionsMenu } from './QueryActionsMenu';
import { SaveButton } from './SaveButton';
import { TransformationActionButtons } from './TransformationActionButtons';
import { WarningBadges } from './WarningBadges';
import { getSelectedActionTarget, type HeaderActionTarget } from './headerActionTarget';

interface HeaderActionsProps {
  containerRef?: RefObject<HTMLDivElement | null>;
  /** The card to act on. Defaults to the selected card. */
  target?: HeaderActionTarget;
  source?: CardActionSource;
  showFeedbackButton?: boolean;
}

/**
 * Container for all action buttons in the query editor header.
 *
 * @remarks
 * Manages actions (hide, delete) for the target query or transformation, which defaults to the
 * selected card. Delete confirmation behavior is configured per type in getQueryEditorTypeConfig
 * and handled by the Actions component.
 */
export function HeaderActions({
  containerRef,
  target: targetProp,
  source = 'content_header',
  showFeedbackButton = true,
}: HeaderActionsProps) {
  const uiState = useQueryEditorUIContext();
  const { toggleQueryHide, toggleTransformationDisabled, deleteQuery, deleteTransformation } = useActionsContext();
  const target = targetProp ?? getSelectedActionTarget(uiState);

  if (!target) {
    return null;
  }

  const isTransformation = target.cardType === QueryEditorType.Transformation;
  const item = isTransformation
    ? transformationToActionItem(target.transformation)
    : queryToActionItem(target.query, { type: target.cardType });

  const onToggleHide = () => {
    if (target.cardType === QueryEditorType.Transformation) {
      toggleTransformationDisabled(target.transformation.transformId);
    } else {
      toggleQueryHide(target.query.refId);
    }
  };

  const onDelete = () => {
    if (target.cardType === QueryEditorType.Transformation) {
      deleteTransformation(target.transformation.transformId);
    } else {
      deleteQuery(target.query.refId);
    }
  };

  return (
    <Stack gap={1} alignItems="center">
      {!isTransformation && (
        <>
          <WarningBadges refId={target.query.refId} />
          <SaveButton target={target} parentRef={containerRef} />
          <PluginActions target={target} app={CoreApp.PanelEditor} />
        </>
      )}
      <Actions
        contentHeader={true}
        source={source}
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
      {showFeedbackButton && <ExperimentalFeedbackButton />}
      {isTransformation ? (
        <TransformationActionButtons transformation={target.transformation} source={source} />
      ) : (
        <QueryActionsMenu target={target} source={source} />
      )}
    </Stack>
  );
}
