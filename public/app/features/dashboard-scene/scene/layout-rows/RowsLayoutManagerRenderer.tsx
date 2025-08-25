import { css } from '@emotion/css';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { MultiValueVariable, SceneComponentProps, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { RowItem } from './RowItem';
import { RowItemRepeater } from './RowItemRepeater';
import { RowsLayoutManager } from './RowsLayoutManager';

export function RowLayoutManagerRenderer({ model }: SceneComponentProps<RowsLayoutManager>) {
  const { rows, key } = model.useState();
  const { isEditing } = useDashboardState(model);
  const styles = useStyles2(getStyles);
  const { hasCopiedRow } = useClipboardState();
  const soloPanelContext = useSoloPanelContext();

  if (soloPanelContext) {
    return rows.map((row) => <RowWrapper row={row} manager={model} key={row.state.key!} />);
  }

  const isClone = isRepeatCloneOrChildOf(model);

  return (
    <DragDropContext
      onBeforeDragStart={(start) => model.forceSelectRow(start.draggableId)}
      onDragEnd={(result) => {
        if (!result.destination) {
          return;
        }

        if (result.destination.index === result.source.index) {
          return;
        }

        model.moveRow(result.draggableId, result.source.index, result.destination.index);
      }}
    >
      <Droppable droppableId={key!} direction="vertical">
        {(dropProvided) => (
          <div className={styles.wrapper} ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            {rows.map((row) => (
              <RowWrapper row={row} manager={model} key={row.state.key!} />
            ))}
            {dropProvided.placeholder}
            {isEditing && !isClone && (
              <div className="dashboard-canvas-add-button">
                <Button
                  icon="plus"
                  variant="primary"
                  fill="text"
                  onClick={() => model.addNewRow()}
                  data-testid={selectors.components.CanvasGridAddActions.addRow}
                >
                  <Trans i18nKey="dashboard.canvas-actions.new-row">New row</Trans>
                </Button>
                {hasCopiedRow && (
                  <Button
                    icon="clipboard-alt"
                    variant="primary"
                    fill="text"
                    onClick={() => model.pasteRow()}
                    data-testid={selectors.components.CanvasGridAddActions.pasteRow}
                  >
                    <Trans i18nKey="dashboard.canvas-actions.paste-row">Paste row</Trans>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
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
    }),
  };
}
