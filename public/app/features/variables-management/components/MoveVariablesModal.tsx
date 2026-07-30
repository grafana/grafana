import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { canManageGlobalVariables, getVariableFolderPickerExcludeUIDs } from '../utils';

export interface MoveVariablesModalProps {
  count: number;
  isMoving: boolean;
  /** True when the selection includes org-global variables (no folder scope). */
  includesGlobalVariables?: boolean;
  onConfirm: (targetFolderUid: string | undefined) => void;
  onDismiss: () => void;
}

export function MoveVariablesModal({
  count,
  isMoving,
  includesGlobalVariables = false,
  onConfirm,
  onDismiss,
}: MoveVariablesModalProps) {
  const allowGlobalScope = canManageGlobalVariables();
  // '' is root/global. Non-editors hide root, so start empty (undefined) — NestedFolderPicker
  // labels '' as "Dashboards" even when showRootFolder is false.
  const [targetFolderUid, setTargetFolderUid] = useState<string | undefined>(() =>
    canManageGlobalVariables() ? '' : undefined
  );
  const canConfirm = allowGlobalScope || Boolean(targetFolderUid);
  // Non-editors cannot delete global variables, so a "move" from root becomes a copy.
  const willCopyGlobals = !allowGlobalScope && includesGlobalVariables;

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
          : willCopyGlobals
            ? t('variables-management.move-modal.body-folder-only-with-global', '', {
                count,
                defaultValue_one:
                  'Move {{count}} selected variable to a folder you can edit. Global (root) variables are copied instead of moved — removing the original requires Editor permission.',
                defaultValue_other:
                  'Move {{count}} selected variables to a folder you can edit. Global (root) variables are copied instead of moved — removing the originals requires Editor permission.',
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
