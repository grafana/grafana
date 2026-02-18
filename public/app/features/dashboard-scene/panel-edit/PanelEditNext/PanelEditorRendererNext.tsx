import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Spinner, ToolbarButton, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../../scene/NavToolbarActions';
import { PanelEditor } from '../PanelEditor';
import { scrollReflowMediaCondition } from '../useScrollReflowLimit';

import { VizAndDataPaneNext } from './VizAndDataPaneNext';
import { usePanelEditorShell } from './hooks';

export function PanelEditorRendererNext({ model }: SceneComponentProps<PanelEditor>) {
  const { dashboard, optionsPane, containerRef, containerHeight, containerWidth, splitter } =
    usePanelEditorShell(model);
  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } = splitter;

  const styles = useStyles2(getWrapperStyles);

  return (
    <div className={styles.container} ref={containerRef}>
      <NavToolbarActions dashboard={dashboard} />
      <div
        {...containerProps}
        className={cx(containerProps.className, styles.content)}
        data-testid={selectors.components.PanelEditor.General.content}
      >
        <div {...primaryProps} className={cx(primaryProps.className, styles.body)}>
          <VizAndDataPaneNext model={model} containerHeight={containerHeight} containerWidth={containerWidth} />
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
  );
}

function getWrapperStyles(theme: GrafanaTheme2) {
  const scrollReflowMediaQuery = '@media ' + scrollReflowMediaCondition;
  return {
    container: css({
      height: '100%',
    }),
    content: css({
      position: 'absolute',
      width: '100%',
      height: '100%',
      overflow: 'unset',
      paddingTop: theme.spacing(2),
      [scrollReflowMediaQuery]: {
        height: 'auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(470px, 1fr) 330px',
        gridTemplateRows: '1fr',
        gap: theme.spacing(1),
        position: 'static',
        width: '100%',
      },
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
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
