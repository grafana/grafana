import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { KioskMode } from 'app/types/dashboard';

import { NotebookToolbar } from '../toolbar/NotebookToolbar';

import { NotebookEditHistoryControls } from './NotebookEditHistoryControls';
import { useNotebookEmbedHostConfig } from './NotebookEmbeddedContext';
import { NotebookSaveStatus } from './NotebookSaveStatus';
import { type NotebookScene } from './NotebookScene';

interface Props {
  model: NotebookScene;
  /**
   * Height of the fixed chrome above the row, or 0 where there is none. A prop rather than context
   * or scene state because one scene can be mounted under the app header and in a host without one
   * at the same time; a prop is per-mount by construction.
   */
  stickyOffset: number;
}

/**
 * Rendered by each surface that wants it rather than by the scene, so the PDF capture route can
 * simply leave it out. `hideTimeControls` and kiosk mode stay here: they are properties of the
 * notebook and the display, not of the surface.
 */
export function NotebookSceneControls({ model, stickyOffset }: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles);
  const { timePicker, refreshPicker, hideTimeControls, isEditing, uid } = model.useState();
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  // A display someone has put a notebook on: everything you would act on goes away — save status,
  // undo/redo, and the toolbar below — but the time controls stay, since a live display may well
  // want the range visible.
  const isKioskFull = kioskMode === KioskMode.Full;

  const hostConfig = useNotebookEmbedHostConfig();
  const usesCanvasBackground = hostConfig.embedded || !visualRefreshEnabled;

  return (
    <div
      className={cx(
        styles.controls,
        usesCanvasBackground ? styles.controlsCanvasBackground : styles.controlsPageBackground
      )}
      style={{ top: stickyOffset, background: hostConfig.controlsBackground }}
      data-testid={selectors.pages.Notebooks.Item.controls}
    >
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

const getStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    alignItems: 'center',
    // `safe`, because a plain flex-end row overflows to the left, over the docked nav.
    justifyContent: 'safe flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    // Only from md up: on a narrow viewport the row is a large share of the screen, so the dashboard lets
    // it scroll away rather than eat the reading area, and this follows suit.
    [theme.breakpoints.up('md')]: {
      position: 'sticky',
      // Above the docked sidebar, or the time picker's popover opens behind it. Same reasoning and same
      // token the dashboard's controls chrome uses.
      zIndex: theme.zIndex.sidemenu,
    },
  }),
  controlsCanvasBackground: css({
    background: theme.colors.background.canvas,
  }),
  controlsPageBackground: css({
    background: theme.colors.background.page,
  }),
});
