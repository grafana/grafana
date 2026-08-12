import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { canManageGlobalVariables, canManageVariableScope, getVariableFolderPickerExcludeUIDs } from '../utils';

export interface MoveVariablesModalProps {
  count: number;
  isMoving: boolean;
  onConfirm: (targetFolderUid: string | undefined) => void;
  onDismiss: () => void;
}

export function MoveVariablesModal({ count, isMoving, onConfirm, onDismiss }: MoveVariablesModalProps) {
  const allowGlobalScope = canManageGlobalVariables();
  // '' is root/global. Non-editors hide root, so start empty (undefined) — NestedFolderPicker
  // labels '' as "Dashboards" even when showRootFolder is false.
  const [targetFolderUid, setTargetFolderUid] = useState<string | undefined>(() =>
    canManageGlobalVariables() ? '' : undefined
  );
  const { data: targetFolder } = useGetFolderQueryFacade(targetFolderUid || undefined);
  // Match the editor Save gate: require CanEdit on folder targets (picker alone is not enough
  // for team folders / other surfaces that may still appear without Edit).
  const targetFolderMatches = Boolean(targetFolderUid && targetFolder?.uid === targetFolderUid);
  const targetFolderCanEdit = targetFolderMatches ? targetFolder?.canEdit : undefined;
  const targetScopeReady = !targetFolderUid || targetFolderMatches;
  const canConfirm = targetScopeReady && canManageVariableScope(targetFolderUid, targetFolderCanEdit, allowGlobalScope);

  return (
    <Modal isOpen title={t('variables-management.move-modal.title', 'Move variables')} onDismiss={onDismiss}>
      <p>
        {allowGlobalScope
          ? t('variables-management.move-modal.body', '', {
              count,
              defaultValue_one:
                'Move {{count}} selected variable. Choosing the root Dashboards folder makes it global (available everywhere in the organization).',
              defaultValue_other:
                'Move {{count}} selected variables. Choosing the root Dashboards folder makes them global (available everywhere in the organization).',
            })
          : t('variables-management.move-modal.body-folder-only', '', {
              count,
              defaultValue_one: 'Move {{count}} selected variable to a folder you can edit.',
              defaultValue_other: 'Move {{count}} selected variables to a folder you can edit.',
            })}
      </p>
      <Field noMargin label={t('variables-management.move-modal.folder-label', 'Folder')}>
        <FolderPicker
          showRootFolder={allowGlobalScope}
          value={targetFolderUid}
          onChange={(uid) => setTargetFolderUid(allowGlobalScope ? (uid ?? '') : uid)}
          excludeUIDs={getVariableFolderPickerExcludeUIDs()}
        />
      </Field>
      <Modal.ButtonRow>
        <Stack gap={2}>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="variables-management.move-modal.cancel">Cancel</Trans>
          </Button>
          <Button disabled={isMoving || !canConfirm} onClick={() => onConfirm(targetFolderUid || undefined)}>
            {isMoving
              ? t('variables-management.move-modal.moving', 'Moving...')
              : t('variables-management.move-modal.move', 'Move')}
          </Button>
        </Stack>
      </Modal.ButtonRow>
    </Modal>
  );
}
