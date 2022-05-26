import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { StandardEditorProps } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

import { PanelOptions } from '../models.gen';

import { TreeNode } from './TreeNode';
import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

export class TreeNavigationEditor extends PureComponent<Props> {
  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    const styles = getStyles();

    const elements = settings.scene?.root.elements;
    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];

    const excludeBaseLayer = false;

    const onDragEnd = (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      if (!settings?.layer) {
        return;
      }

      const { layer } = settings;

      const count = layer.elements.length - 1;
      const src = (result.source.index - count) * -1;
      const dst = (result.destination.index - count) * -1;

      layer.reorder(src, dst);
    };

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="droppable">
          {(provided, snapshot) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {(() => {
                // reverse order
                const rows: any = [];
                const lastLayerIndex = excludeBaseLayer ? 1 : 0;
                // const shouldRenderDragIconLengthThreshold = excludeBaseLayer ? 2 : 1;
                for (let i = elements.length - 1; i >= lastLayerIndex; i--) {
                  const element = elements[i];
                  rows.push(
                    <ul className={styles.treeListContainer} key={element.UID}>
                      <TreeNode node={element} selection={selection} settings={settings} index={rows.length} />
                    </ul>
                  );
                }

                return rows;
              })()}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }
}

const getStyles = stylesFactory(() => {
  return {
    treeListContainer: css`
      list-style: none;
    `,
  };
});
