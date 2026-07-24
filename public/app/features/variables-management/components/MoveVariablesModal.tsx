import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { getVariableFolderPickerExcludeUIDs } from '../utils';

export interface MoveVariablesModalProps {
  count: number;
  isMoving: boolean;
  onConfirm: (targetFolderUid: string | undefined) => void;
  onDismiss: () => void;
}

export function MoveVariablesModal({ count, isMoving, onConfirm, onDismiss }: MoveVariablesModalProps) {
  // '' is the FolderPicker's uid for the root Dashboards folder (global scope).
  const [targetFolderUid, setTargetFolderUid] = useState('');

  return (
    <Modal isOpen title={t('variables-management.move-modal.title', 'Move variables')} onDismiss={onDismiss}>
      <p>
        {t('variables-management.move-modal.body', '', {
          count,
          defaultValue_one:
            'Move {{count}} selected variable. Choosing the root Dashboards folder makes it global (available everywhere in the organization).',
          defaultValue_other:
            'Move {{count}} selected variables. Choosing the root Dashboards folder makes them global (available everywhere in the organization).',
        })}
      </p>
      <Field noMargin label={t('variables-management.move-modal.folder-label', 'Folder')}>
        <FolderPicker
          showRootFolder
          value={targetFolderUid}
          onChange={(uid) => setTargetFolderUid(uid ?? '')}
          excludeUIDs={getVariableFolderPickerExcludeUIDs()}
        />
      </Field>
      <Modal.ButtonRow>
        <Stack gap={2}>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="variables-management.move-modal.cancel">Cancel</Trans>
          </Button>
          <Button disabled={isMoving} onClick={() => onConfirm(targetFolderUid || undefined)}>
            {isMoving
              ? t('variables-management.move-modal.moving', 'Moving...')
              : t('variables-management.move-modal.move', 'Move')}
          </Button>
        </Stack>
      </Modal.ButtonRow>
    </Modal>
  );
}
