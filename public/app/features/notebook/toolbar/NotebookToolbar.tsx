import { useState } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, copyTextToClipboard, Dropdown, IconButton, Menu, ToolbarButton } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_DELETE_SOURCE, NOTEBOOK_EXPORT_SOURCE, NOTEBOOK_LINK_COPY_SOURCE } from '../analytics/types';
import { DeleteNotebookModal } from '../delete/DeleteNotebookModal';
import { useDeleteNotebook } from '../delete/useDeleteNotebook';
import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { AttachToIncidentModal } from '../incidents/AttachToIncidentModal';
import { DeclareIncidentModal } from '../incidents/DeclareIncidentModal';
import { IrmMenuItem } from '../incidents/IrmMenuItem';
import { canDeleteNotebooks } from '../permissions';
import { NotebookEditToggle } from '../scene/NotebookEditToggle';
import { useIsNotebookEmbedded } from '../scene/NotebookEmbeddedContext';
import { type NotebookScene } from '../scene/NotebookScene';
import { NotebookDeletedEvent } from '../scene/events';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { NOTEBOOKS_BASE_URL, notebookShareUrl } from '../urls';

/**
 * The notebook view's action cluster: copy link, the edit toggle, and the "more actions" kebab
 * (export, IRM, delete). Embedded inline in the scene's own controls row (`NotebookScene.tsx`).
 *
 * Rendered for a notebook that does not exist yet as well, so that creating one by typing does not
 * push the document down once a uid shows up. Copy link and the kebab need a notebook that exists,
 * so until there is one they are disabled and say why; the edit toggle works either way.
 */
export function NotebookToolbar({ uid, scene }: { uid?: string; scene: NotebookScene }) {
  return uid ? <NotebookActions uid={uid} scene={scene} /> : <UnavailableActions scene={scene} />;
}

function NotebookActions({ uid, scene }: { uid: string; scene: NotebookScene }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { remove, isDeleting } = useDeleteNotebook(NOTEBOOK_DELETE_SOURCE.NOTEBOOK_TOOLBAR);
  // Owned here, not by the menu items: those are inside the Dropdown overlay, which unmounts as the
  // menu closes.
  const [isDeclaring, setIsDeclaring] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const notifyApp = useAppNotification();
  // Embedded hosts (e.g. Assistant's canvas) get only the edit toggle — Delete would navigate the
  // whole host away.
  const isEmbedded = useIsNotebookEmbedded();

  const onCopyLink = async () => {
    try {
      await copyTextToClipboard(notebookShareUrl(uid));
      NotebookAnalytics.linkCopied(uid, NOTEBOOK_LINK_COPY_SOURCE.NOTEBOOK_TOOLBAR);
      notifyApp.success(t('notebooks.list.table.link-copied', 'Link copied to clipboard'));
    } catch {
      notifyApp.error(t('notebooks.list.table.copy-link-error', 'Failed to copy link'));
    }
  };

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
    // Tells the page state manager to evict this uid from its scene cache. Published rather than
    // called directly to avoid an import cycle back to this file.
    scene.publishEvent(new NotebookDeletedEvent(), true);
    // replace, not push: Back must not return to a page whose notebook no longer exists.
    locationService.replace(NOTEBOOKS_BASE_URL);
  };

  // Serialized from the scene rather than refetched: the page already holds the notebook, and this
  // way an export reflects what is on screen. Export's actions are flattened directly into this menu
  // rather than nested under their own "Export" submenu.
  const moreMenu = () => (
    <Menu>
      <NotebookExportMenu
        uid={uid}
        getSpec={async () => transformNotebookSceneToSaveModel(scene)}
        source={NOTEBOOK_EXPORT_SOURCE.NOTEBOOK_TOOLBAR}
      />
      <IrmMenuItem onDeclare={() => setIsDeclaring(true)} onAttach={() => setIsAttaching(true)} />
      {canDeleteNotebooks() && (
        <>
          <Menu.Divider />
          <Menu.Item
            destructive
            label={t('notebooks.delete.confirm', 'Delete')}
            icon="trash-alt"
            onClick={() => setIsConfirmingDelete(true)}
          />
        </>
      )}
    </Menu>
  );

  return (
    <>
      {!isEmbedded && (
        <ToolbarButton
          variant="canvas"
          icon="share-alt"
          tooltip={t('notebooks.view.copy-link', 'Copy link')}
          onClick={onCopyLink}
        />
      )}
      <NotebookEditToggle notebook={scene} />
      {!isEmbedded && (
        <Dropdown overlay={moreMenu} placement="bottom-end">
          <IconButton
            name="ellipsis-v"
            variant="secondary"
            size="sm"
            // Dropdown injects aria-expanded but not aria-haspopup, so without this the trigger
            // announces as a plain button and gives no hint that it opens a menu.
            aria-haspopup="menu"
            // No aria-label alongside: IconButton uses a string tooltip as the accessible name.
            tooltip={t('notebooks.view.more-actions', 'More actions')}
          />
        </Dropdown>
      )}
      {isDeclaring && (
        <DeclareIncidentModal uid={uid} title={scene.state.title} onDismiss={() => setIsDeclaring(false)} />
      )}
      {isAttaching && (
        <AttachToIncidentModal uid={uid} title={scene.state.title} onDismiss={() => setIsAttaching(false)} />
      )}
      {isConfirmingDelete && (
        <DeleteNotebookModal
          title={scene.state.title}
          isDeleting={isDeleting}
          onConfirm={onConfirmDelete}
          onDismiss={() => setIsConfirmingDelete(false)}
        />
      )}
    </>
  );
}

/**
 * Copy link and the kebab, disabled: there is no notebook to link to, export or delete yet. They keep
 * the sizing of the real ones so that nothing moves when the notebook is created. The edit toggle is
 * the real one throughout — entering edit mode does not require a uid.
 *
 * Both are plain Buttons rather than IconButtons: Grafana's Button swaps the native disabled attribute
 * for aria-disabled when it has a tooltip, so the reason stays reachable instead of being on an
 * element that ignores the pointer — IconButton has no such fallback.
 */
function UnavailableActions({ scene }: { scene: NotebookScene }) {
  const reason = t('notebooks.view.available-once-created', 'Available once you write something');
  // A draft embed never gets a uid, so this branch renders for its whole session — same rule.
  const isEmbedded = useIsNotebookEmbedded();

  return (
    <>
      {!isEmbedded && (
        <Button
          variant="secondary"
          size="md"
          icon="share-alt"
          disabled
          tooltip={reason}
          aria-label={t('notebooks.view.copy-link', 'Copy link')}
        />
      )}
      <NotebookEditToggle notebook={scene} />
      {!isEmbedded && (
        <Button
          variant="secondary"
          size="sm"
          icon="ellipsis-v"
          disabled
          tooltip={reason}
          aria-label={t('notebooks.view.more-actions', 'More actions')}
        />
      )}
    </>
  );
}
