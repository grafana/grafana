import { css } from '@emotion/css';
import { type ReactElement, useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  ConfirmModal,
  Drawer,
  Dropdown,
  IconButton,
  Menu,
  Modal,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { canMove, deleteObject, getObject, moveToFolder, openPath, shareURL } from '../actions';
import { FIELD, type ResultItem } from '../api/globalSearchApi';
import { getKindInfo } from '../kinds';

interface Props {
  item: ResultItem;
  title: string;
  /** Why Move is off, such as a read-only repository. */
  moveLockedReason?: string;
  /** Why Delete is off, such as a read-only repository. */
  deleteLockedReason?: string;
  onMoved: () => void;
  onDeleted: () => void;
}

/** Disabled menu items can't show why on their own. */
function WithReason({ reason, children }: { reason?: string; children: ReactElement }) {
  if (!reason) {
    return children;
  }
  return (
    <Tooltip content={reason} placement="left">
      <div>{children}</div>
    </Tooltip>
  );
}

export function RowActions({ item, title, moveLockedReason, deleteLockedReason, onMoved, onDeleted }: Props) {
  const styles = useStyles2(getStyles);
  const ref = item.resource;
  const path = openPath(ref);

  const [json, setJson] = useState<string>();
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetFolder, setTargetFolder] = useState<string | undefined>();

  const fail = (err: unknown) =>
    appEvents.emit(AppEvents.alertError, [extractErrorMessage(err) ?? t('urv.actions.failed', 'Action failed')]);

  const onCopyLink = async () => {
    const url = shareURL(ref);
    if (!url) {
      return;
    }
    await navigator.clipboard.writeText(url);
    appEvents.emit(AppEvents.alertSuccess, [t('urv.actions.link-copied', 'Link copied')]);
  };

  const onViewJson = async () => {
    try {
      setJson(JSON.stringify(await getObject(ref), null, 2));
    } catch (err) {
      fail(err);
    }
  };

  const onMove = async () => {
    try {
      await moveToFolder(ref, targetFolder);
      setIsMoving(false);
      onMoved();
    } catch (err) {
      fail(err);
    }
  };

  const onDelete = async () => {
    try {
      await deleteObject(ref);
      setIsDeleting(false);
      onDeleted();
    } catch (err) {
      fail(err);
    }
  };

  const currentFolder = item.fields?.[FIELD.folder];

  const menu = (
    <Menu>
      {path && <Menu.Item label={t('urv.actions.open', 'Open')} icon="external-link-alt" url={path} />}
      {path && <Menu.Item label={t('urv.actions.copy-link', 'Copy link')} icon="link" onClick={onCopyLink} />}
      <Menu.Item label={t('urv.actions.view-json', 'View JSON')} icon="brackets-curly" onClick={onViewJson} />
      {canMove(ref) && (
        <WithReason reason={moveLockedReason}>
          <Menu.Item
            label={t('urv.actions.move', 'Move')}
            icon="folder-open"
            disabled={Boolean(moveLockedReason)}
            onClick={() => {
              setTargetFolder(typeof currentFolder === 'string' ? currentFolder : undefined);
              setIsMoving(true);
            }}
          />
        </WithReason>
      )}
      <Menu.Divider />
      <WithReason reason={deleteLockedReason}>
        <Menu.Item
          label={t('urv.actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          disabled={Boolean(deleteLockedReason)}
          onClick={() => setIsDeleting(true)}
        />
      </WithReason>
    </Menu>
  );

  return (
    <>
      <Dropdown overlay={menu} placement="bottom-end">
        <IconButton
          name="ellipsis-v"
          aria-label={t('urv.actions.menu', 'Actions for {{title}}', { title, interpolation: { escapeValue: false } })}
        />
      </Dropdown>

      {json !== undefined && (
        <Drawer title={title} subtitle={`${ref.group}/${ref.resource}/${ref.name}`} onClose={() => setJson(undefined)}>
          <pre className={styles.json}>{json}</pre>
        </Drawer>
      )}

      <Modal
        isOpen={isMoving}
        title={t('urv.actions.move-title', 'Move {{title}}', { title, interpolation: { escapeValue: false } })}
        onDismiss={() => setIsMoving(false)}
      >
        <NestedFolderPicker
          value={targetFolder}
          onChange={(uid) => setTargetFolder(uid)}
          showRootFolder
          permission="edit"
          excludeUIDs={ref.resource === 'folders' ? [ref.name] : undefined}
        />
        <Modal.ButtonRow>
          <Stack gap={1}>
            <Button variant="secondary" fill="outline" onClick={() => setIsMoving(false)}>
              <Trans i18nKey="urv.actions.cancel">Cancel</Trans>
            </Button>
            <Button onClick={onMove}>
              <Trans i18nKey="urv.actions.move-confirm">Move</Trans>
            </Button>
          </Stack>
        </Modal.ButtonRow>
      </Modal>

      <ConfirmModal
        isOpen={isDeleting}
        title={t('urv.actions.delete-title', 'Delete {{title}}', { title, interpolation: { escapeValue: false } })}
        body={t('urv.actions.delete-body', 'This deletes the {{type}} for everyone.', {
          type: getKindInfo(ref).label(),
          interpolation: { escapeValue: false },
        })}
        confirmText={t('urv.actions.delete-confirm', 'Delete')}
        onConfirm={onDelete}
        onDismiss={() => setIsDeleting(false)}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  json: css({
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});
