import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { KioskMode } from 'app/types/dashboard';

import { NotebookToolbar } from '../toolbar/NotebookToolbar';

import { NotebookEditHistoryControls } from './NotebookEditHistoryControls';
import { NotebookSaveStatus } from './NotebookSaveStatus';
import { type NotebookScene } from './NotebookScene';

interface Props {
  model: NotebookScene;
  /**
   * How far down the sticky row should stop, in pixels — the height of whatever fixed chrome sits
   * above it, or 0 where there is none.
   *
   * Supplied by whoever renders this rather than read from context or scene state, because it is a
   * property of the tree the notebook is drawn in: the same scene object can be mounted on the
   * /notebooks route, under the app header, and in a host that has none, at the same time. A prop is
   * per-mount by construction, which is exactly the invariant that needs holding.
   */
  stickyOffset: number;
}

/**
 * The notebook's own controls row: save status, undo/redo, the time controls, and the toolbar
 * (which owns the edit toggle and the copy/export/delete actions).
 *
 * Rendered by each surface that wants it rather than by the scene, so that a surface which does not
 * — the PDF capture route — simply leaves it out instead of the scene having to ask who is drawing
 * it. See NotebookSceneRenderer for the document half.
 *
 * `hideTimeControls` and kiosk mode are still read here, deliberately: those are properties of the
 * notebook and of the display, not of the surface, so they are not the caller's business.
 */
export function NotebookSceneControls({ model, stickyOffset }: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, stickyOffset, visualRefreshEnabled);
  const { timePicker, refreshPicker, hideTimeControls, isEditing, uid } = model.useState();
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  // A display someone has put a notebook on: everything you would act on goes away — save status,
  // undo/redo, and the toolbar below — but the time controls stay, since a live display may well
  // want the range visible.
  const isKioskFull = kioskMode === KioskMode.Full;

  return (
    <div className={styles.controls}>
      {!isKioskFull && (
        <>
          {/* Not gated on edit mode: the assistant writes without entering it, and a failed save has
              to be visible and retryable there too. This renders nothing until there is something to
              say. */}
          <NotebookSaveStatus autosave={model.autosave} />
          {isEditing && <NotebookEditHistoryControls history={model.editHistory} />}
        </>
      )}
      {!hideTimeControls && (
        <>
          <timePicker.Component model={timePicker} />
          <refreshPicker.Component model={refreshPicker} />
        </>
      )}
      {/* The toolbar checks nothing about kiosk itself — it is chrome, so the row simply does not
          render it on a kiosk display. */}
      {!isKioskFull && <NotebookToolbar uid={uid} scene={model} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, stickyOffset: number, visualRefreshEnabled: boolean) => ({
  controls: css({
    display: 'flex',
    alignItems: 'center',
    // `safe`, because a plain flex-end row overflows to the left, over the docked nav.
    justifyContent: 'safe flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    // A sticky row is transparent by default, so the notebook would scroll visibly through it. These two
    // tokens are the page's own background (PageLayoutType.Custom, see getDefaultBackgroundForLayout), so
    // the row reads as chrome rather than as a tinted band — same pairing DashboardControlsChrome uses.
    background: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas,
    // Only from md up: on a narrow viewport the row is a large share of the screen, so the dashboard lets
    // it scroll away rather than eat the reading area, and this follows suit.
    [theme.breakpoints.up('md')]: {
      position: 'sticky',
      top: stickyOffset,
      // Above the docked sidebar, or the time picker's popover opens behind it. Same reasoning and same
      // token the dashboard's controls chrome uses.
      zIndex: theme.zIndex.sidemenu,
    },
  }),
});
