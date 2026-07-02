import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Spinner, ToolbarButton, useStyles2 } from '@grafana/ui';

import { LibraryPanelEditModals } from '../LibraryPanelEditModals';
import { type PanelEditor } from '../PanelEditor';
import { scrollReflowMediaCondition } from '../useScrollReflowLimit';

import { VizAndDataPaneNext } from './VizAndDataPaneNext';
import { usePanelEditorShell } from './hooks';

export function PanelEditorRendererNext({ model }: SceneComponentProps<PanelEditor>) {
  const { optionsPane, splitter, controls } = usePanelEditorShell(model);
  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } = splitter;

  const styles = useStyles2(getWrapperStyles);

  return (
    <div className={styles.container} data-testid={selectors.components.PanelEditor.General.content}>
      {controls && <controls.Component model={controls} />}
      <LibraryPanelEditModals model={model} />
      <div className={styles.contentRegion}>
        <div {...containerProps} className={cx(containerProps.className, styles.content)}>
          <div {...primaryProps} className={cx(primaryProps.className, styles.body)}>
            <VizAndDataPaneNext model={model} />
          </div>
          <div {...splitterProps} />
          <div {...secondaryProps} className={cx(secondaryProps.className, styles.optionsPane)}>
            {splitterState.collapsed && (
              <div className={styles.expandOptionsWrapper}>
                <ToolbarButton
                  tooltip={t('dashboard-scene.panel-editor-renderer.tooltip-open-options-pane', 'Open options pane')}
                  icon={'arrow-to-right'}
                  onClick={onToggleCollapse}
                  variant="canvas"
                  className={styles.rotate180}
                  aria-label={t(
                    'dashboard-scene.panel-editor-renderer.aria-label-open-options-pane',
                    'Open options pane'
                  )}
                />
              </div>
            )}
            {!splitterState.collapsed && optionsPane && <optionsPane.Component model={optionsPane} />}
            {!splitterState.collapsed && !optionsPane && <Spinner />}
          </div>
        </div>
      </div>
    </div>
  );
}

function getWrapperStyles(theme: GrafanaTheme2) {
  const scrollReflowMediaQuery = '@media ' + scrollReflowMediaCondition;

  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: '1 1 0',
      minHeight: 0,
    }),
    // Sized, positioned box holding the splitter beneath the controls row. `content` fills it
    // absolutely so the viz/data grid and its resize hooks measure a definite size on the first
    // layout pass; without that the panes render narrow and then snap to full width on load.
    contentRegion: css({
      position: 'relative',
      flexGrow: 1,
      minHeight: 0,
      [scrollReflowMediaQuery]: {
        // Short screens reflow into a scrolling grid; collapse this wrapper out of the box tree so
        // `content` flows directly in the column and grows with its content.
        display: 'contents',
      },
    }),
    content: css({
      position: 'absolute',
      inset: 0,
      overflow: 'unset',
      [scrollReflowMediaQuery]: {
        position: 'static',
        height: 'auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(470px, 1fr) 330px',
        gridTemplateRows: '1fr',
        gap: theme.spacing(1),
        width: '100%',
      },
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      minHeight: 0,
    }),
    optionsPane: css({
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.default,
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
    rotate180: css({
      rotate: '180deg',
    }),
  };
}
