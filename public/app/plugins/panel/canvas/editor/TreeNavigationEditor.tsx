import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { StandardEditorProps } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

import { FrameState } from '../../../../features/canvas/runtime/frame';
import { RootElement } from '../../../../features/canvas/runtime/root';
import { PanelOptions } from '../models.gen';
import { FlatElement, getFlatElements, getParent, reorderElements } from '../tree';
import { LayerActionID } from '../types';

import { TreeView } from './TreeView';
import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

type State = {
  flatElements: FlatElement[];
};

export class TreeNavigationEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      flatElements: getFlatElements(props.item?.settings?.scene.root),
    };
  }

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const src = this.state.flatElements[result.source.index];
    const dest = this.state.flatElements[result.destination.index];

    if (src.node.parent === dest.node.parent && src.node) {
      src.node.parent?.reorderTree(src.node, dest.node);
    } else {
      src.node.parent?.doAction(LayerActionID.Delete, src.node);
      src.node.parent = dest.node instanceof FrameState ? dest.node : dest.node.parent;
      src.depth = this.setDepth(dest);

      // @TODO dest = frame
      if (dest.node.parent instanceof RootElement) {
        dest.node.parent.elements.push(src.node);
        src.node.updateData(dest.node.parent.scene.context);
      } else if (dest.node.parent instanceof FrameState) {
        const destIndex = dest.node.parent.elements.indexOf(dest.node);
        dest.node.parent?.elements.splice(destIndex, 0, src.node);

        dest.node.parent.scene.byName.set(src.node.options.name, src.node);
        dest.node.parent.scene.save();

        dest.node.parent?.reorderTree(src.node, dest.node);
        src.node.updateData(dest.node.parent.scene.context);
      }

      dest.node.parent?.reinitializeMoveable();
    }

    this.reorder(src, dest);
  };

  reorder = (src: FlatElement, dest: FlatElement) => {
    const result = reorderElements(src, dest, this.state.flatElements);
    this.setState({ flatElements: result });

    const { settings } = this.props.item;
    settings?.scene.root.reinitializeMoveable();
  };

  // @TODO update depth for nested frames when we'll have the functionality
  setDepth = (dest: FlatElement) => {
    let depth = 1;
    if (dest.node instanceof FrameState) {
      depth = dest.depth + 1;
    } else if (dest.node.parent instanceof FrameState) {
      depth = dest.depth;
    }

    return depth;
  };

  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    const styles = getStyles();

    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="droppable">
          {(provided, snapshot) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {this.state.flatElements.map((element, index) => {
                const parent = getParent(element, this.state.flatElements);
                return (
                  <div className={styles.treeListContainer} key={element.node.UID}>
                    <TreeView node={element} selection={selection} settings={settings} index={index} parent={parent} />
                  </div>
                );
              })}
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
