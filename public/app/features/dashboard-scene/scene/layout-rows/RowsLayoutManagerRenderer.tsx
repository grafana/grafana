import { css, cx } from '@emotion/css';
import { Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { MultiValueVariable, SceneComponentProps, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { getLayoutControlsStyles } from '../layouts-shared/styles';
import { useClipboardState } from '../layouts-shared/useClipboardState';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../types/DashboardDropTarget';

import { RowItem } from './RowItem';
import { RowItemRepeater } from './RowItemRepeater';
import { RowsLayoutManager } from './RowsLayoutManager';

export function RowLayoutManagerRenderer({ model }: SceneComponentProps<RowsLayoutManager>) {
  const { rows, key } = model.useState();
  const { isEditing } = useDashboardState(model);
  const styles = useStyles2(getStyles);
  const layoutControlsStyles = useStyles2(getLayoutControlsStyles);
  const { hasCopiedRow } = useClipboardState();
  const soloPanelContext = useSoloPanelContext();

  // Only act as a drop target when empty (no rows)
  const showAsDropTarget = rows.length === 0;

  if (soloPanelContext) {
    return rows.map((row) => <RowWrapper row={row} manager={model} key={row.state.key!} />);
  }

  const isClone = isRepeatCloneOrChildOf(model);

  return (
    <Droppable droppableId={key!} direction="vertical" type="ROW">
      {(dropProvided) => (
        <div
          className={styles.wrapper}
          ref={dropProvided.innerRef}
          {...dropProvided.droppableProps}
          {...(showAsDropTarget ? { [DASHBOARD_DROP_TARGET_KEY_ATTR]: key } : {})}
        >
          {rows.map((row) => (
            <RowWrapper row={row} manager={model} key={row.state.key!} />
          ))}
          {dropProvided.placeholder}
          {isEditing && !isClone && (
            <div className={cx(layoutControlsStyles.controls, 'dashboard-canvas-controls')}>
              <Button
                icon="plus"
                variant="secondary"
                size="sm"
                onClick={() => model.addNewRow()}
                onPointerUp={(evt) => evt.stopPropagation()}
                data-testid={selectors.components.CanvasGridAddActions.addRow}
              >
                <Trans i18nKey="dashboard.canvas-actions.new-row">New row</Trans>
              </Button>
              {hasCopiedRow && (
                <Button
                  icon="clipboard-alt"
                  variant="secondary"
                  size="sm"
                  onClick={() => model.pasteRow()}
                  onPointerUp={(evt) => evt.stopPropagation()}
                  data-testid={selectors.components.CanvasGridAddActions.pasteRow}
                >
                  <Trans i18nKey="dashboard.canvas-actions.paste-row">Paste row</Trans>
                </Button>
              )}
              <Button
                icon="layers-slash"
                variant="secondary"
                size="sm"
                onClick={() => model.ungroupRows()}
                data-testid={selectors.components.CanvasGridAddActions.ungroupRows}
              >
                <Trans i18nKey="dashboard.canvas-actions.ungroup-rows">Ungroup rows</Trans>
              </Button>
            </div>
          )}
        </div>
      )}
    </Droppable>
  );
}

function RowWrapper({ row, manager }: { row: RowItem; manager: RowsLayoutManager }) {
  const { repeatByVariable } = useSceneObjectState(row, { shouldActivateOrKeepAlive: true });

  if (repeatByVariable) {
    const variable = sceneGraph.lookupVariable(repeatByVariable, manager);

    if (variable instanceof MultiValueVariable) {
      return <RowItemRepeater row={row} key={row.state.key!} manager={manager} variable={variable} />;
    }
  }

  return <row.Component model={row} key={row.state.key!} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flexGrow: 1,
      width: '100%',

      // Show rows layout controls (Add row, etc.) when hovering anywhere in the layout
      // Using > to only affect direct children, not grid controls inside rows
      '&:hover > .dashboard-canvas-controls': {
        opacity: 1,
      },
    }),
  };
}
