import { css } from '@emotion/css';
import { useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { canMove, deleteObject, moveToFolder } from '../actions';
import { type ResultItem } from '../api/globalSearchApi';
import { type ManagerLookup } from '../hooks/useManagerLookup';

interface Props {
  items: ResultItem[];
  manager: ManagerLookup;
  onClear: () => void;
  onMoved: () => void;
  onDeleted: (items: ResultItem[]) => void;
}

/** Runs one request per item and reports how many failed, since there's no bulk API across types. */
async function runAll(items: ResultItem[], action: (item: ResultItem) => Promise<void>) {
  const results = await Promise.allSettled(items.map(action));
  const failed = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (failed.length) {
    appEvents.emit(AppEvents.alertError, [
      t('urv.selection.failed', '', {
        count: failed.length,
        total: items.length,
        defaultValue_one: '{{count}} of {{total}} failed',
        defaultValue_other: '{{count}} of {{total}} failed',
      }),
      extractErrorMessage(failed[0]),
    ]);
  }
  return items.filter((_, index) => results[index].status === 'fulfilled');
}

export function SelectionBar({ items, manager, onClear, onMoved, onDeleted }: Props) {
  const styles = useStyles2(getStyles);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [target, setTarget] = useState<string>();
  const deletable = items.filter((item) => !manager(item).deleteLockedReason);
  const movable = items.filter((item) => canMove(item.resource) && !manager(item).moveLockedReason);

  const onMove = async () => {
    setIsMoving(false);
    await runAll(movable, (item) => moveToFolder(item.resource, target));
    onMoved();
  };

  const onDelete = async () => {
    setIsDeleting(false);
    onDeleted(await runAll(deletable, (item) => deleteObject(item.resource)));
  };

  // When everything is skipped for the same reason, say the reason instead of a count.
  const skippedText = (
    kept: ResultItem[],
    reasonOf: (item: ResultItem) => string | undefined,
    noneText: string,
    countText: (count: number) => string
  ) => {
    if (kept.length === items.length) {
      return undefined;
    }
    if (kept.length > 0) {
      return countText(items.length - kept.length);
    }
    const reasons = new Set(items.map(reasonOf));
    const [onlyReason] = reasons;
    return reasons.size === 1 && onlyReason ? onlyReason : noneText;
  };
  const moveTooltip = skippedText(
    movable,
    (item) => manager(item).moveLockedReason,
    t('urv.selection.move-none', 'None of the selected items can be moved here'),
    (count) =>
      t('urv.selection.move-skipped', '', {
        count,
        defaultValue_one: "{{count}} selected item can't be moved and will be skipped",
        defaultValue_other: "{{count}} selected items can't be moved and will be skipped",
      })
  );
  const deleteTooltip = skippedText(
    deletable,
    (item) => manager(item).deleteLockedReason,
    t('urv.selection.delete-none', 'None of the selected items can be deleted here'),
    (count) =>
      t('urv.selection.delete-skipped', '', {
        count,
        defaultValue_one: "{{count}} selected item can't be deleted here and will be skipped",
        defaultValue_other: "{{count}} selected items can't be deleted here and will be skipped",
      })
  );

  return (
    <div className={styles.bar}>
      <Text weight="medium">
        {t('urv.selection.count', '', {
          count: items.length,
          defaultValue_one: '{{count}} selected',
          defaultValue_other: '{{count}} selected',
        })}
      </Text>
      <Button
        size="sm"
        variant="secondary"
        icon="folder-open"
        disabled={movable.length === 0}
        tooltip={moveTooltip}
        onClick={() => setIsMoving(true)}
      >
        <Trans i18nKey="urv.selection.move">Move</Trans>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        icon="trash-alt"
        disabled={deletable.length === 0}
        tooltip={deleteTooltip}
        onClick={() => setIsDeleting(true)}
      >
        <Trans i18nKey="urv.selection.delete">Delete</Trans>
      </Button>
      <Button size="sm" variant="secondary" fill="text" onClick={onClear}>
        <Trans i18nKey="urv.selection.clear">Clear selection</Trans>
      </Button>

      <Modal
        isOpen={isMoving}
        title={t('urv.selection.move-title', '', {
          count: movable.length,
          defaultValue_one: 'Move {{count}} item',
          defaultValue_other: 'Move {{count}} items',
        })}
        onDismiss={() => setIsMoving(false)}
      >
        <NestedFolderPicker
          value={target}
          onChange={setTarget}
          showRootFolder
          permission="edit"
          excludeUIDs={movable.filter((item) => item.resource.resource === 'folders').map((item) => item.resource.name)}
        />
        <Modal.ButtonRow>
          <Stack gap={1}>
            <Button variant="secondary" fill="outline" onClick={() => setIsMoving(false)}>
              <Trans i18nKey="urv.selection.cancel">Cancel</Trans>
            </Button>
            <Button onClick={onMove}>
              <Trans i18nKey="urv.selection.move-confirm">Move</Trans>
            </Button>
          </Stack>
        </Modal.ButtonRow>
      </Modal>

      <ConfirmModal
        isOpen={isDeleting}
        title={t('urv.selection.delete-title', '', {
          count: deletable.length,
          defaultValue_one: 'Delete {{count}} item',
          defaultValue_other: 'Delete {{count}} items',
        })}
        body={t('urv.selection.delete-body', 'This deletes them for everyone.')}
        confirmText={t('urv.selection.delete-confirm', 'Delete')}
        onConfirm={onDelete}
        onDismiss={() => setIsDeleting(false)}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.primary.transparent,
  }),
});
