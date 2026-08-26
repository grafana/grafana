import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, ClipboardButton, Dropdown, Icon, IconButton, Menu, useStyles2 } from '@grafana/ui';

import { DeleteNotebookModal } from '../delete/DeleteNotebookModal';
import { useDeleteNotebook } from '../delete/useDeleteNotebook';
import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { getNotebookPageStateManager } from '../pages/NotebookPageStateManager';
import { canDeleteNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { NOTEBOOKS_BASE_URL, notebookShareUrl } from '../urls';

/**
 * The notebook view's header bar.
 */
export function NotebookToolbar({ uid, scene }: { uid: string; scene: NotebookScene }) {
  const styles = useStyles2(getStyles);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { remove, isDeleting } = useDeleteNotebook();

  const onConfirmDelete = async () => {
    if (!(await remove(uid, scene.state.title))) {
      setIsConfirmingDelete(false);
      return;
    }

    // Only once the delete has actually landed. The reason to give up on saving is the flush that
    // autosave's teardown performs as we navigate away, and that only happens on this path — called
    // before the request, a failed delete would leave the notebook on screen with saving latched off
    // for the rest of the session, and `abandon` is deliberately one-way.
    //
    // A save can still fire during the request itself, which is harmless: it writes to a notebook
    // that is about to be deleted, and if it lands afterwards it 404s and we are already leaving.
    scene.autosave.abandon();
    // The state manager caches scenes by uid, so without this, going back here would rebuild the
    // deleted notebook from cache rather than reporting it gone.
    getNotebookPageStateManager().removeSceneCache(uid);
    // replace, not push: Back must not return to a page whose notebook no longer exists.
    locationService.replace(NOTEBOOKS_BASE_URL);
  };

  // Serialized from the scene rather than refetched: the page already holds the notebook, and this
  // way an export reflects what is on screen.
  const exportMenu = () => (
    <Menu>
      <NotebookExportMenu uid={uid} getSpec={async () => transformNotebookSceneToSaveModel(scene)} />
    </Menu>
  );

  const deleteMenu = () => (
    <Menu>
      <Menu.Item
        destructive
        label={t('notebooks.delete.confirm', 'Delete')}
        icon="trash-alt"
        onClick={() => setIsConfirmingDelete(true)}
      />
    </Menu>
  );

  return (
    <div className={styles.toolbar}>
      <ClipboardButton variant="secondary" size="sm" icon="link" getText={() => notebookShareUrl(uid)}>
        {t('notebooks.view.copy-link', 'Copy link')}
      </ClipboardButton>
      <Dropdown overlay={exportMenu} placement="bottom-end" onVisibleChange={setIsExportOpen}>
        <Button size="sm" variant="secondary" icon="download-alt" aria-haspopup="menu" aria-expanded={isExportOpen}>
          <Trans i18nKey="notebooks.export.label">Export</Trans>
          &nbsp;
          <Icon name={isExportOpen ? 'angle-up' : 'angle-down'} size="sm" aria-hidden="true" />
        </Button>
      </Dropdown>
      {canDeleteNotebooks() && (
        <Dropdown overlay={deleteMenu} placement="bottom-end">
          <IconButton
            name="ellipsis-v"
            variant="secondary"
            // Dropdown injects aria-expanded but not aria-haspopup, so without this the trigger
            // announces as a plain button and gives no hint that it opens a menu.
            aria-haspopup="menu"
            // No aria-label alongside: IconButton uses a string tooltip as the accessible name.
            tooltip={t('notebooks.view.more-actions', 'More actions')}
          />
        </Dropdown>
      )}
      {isConfirmingDelete && (
        <DeleteNotebookModal
          title={scene.state.title}
          isDeleting={isDeleting}
          onConfirm={onConfirmDelete}
          onDismiss={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});
