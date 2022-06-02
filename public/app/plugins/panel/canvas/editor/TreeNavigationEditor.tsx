import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { StandardEditorProps } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

import { FrameState } from '../../../../features/canvas/runtime/frame';
import { PanelOptions } from '../models.gen';
import { FlatElement, getFlatElements, getParent, reorder } from '../tree';

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

    if (src.node.parent === dest.node.parent) {
      // update the frame
      src.node.parent?.reorder(src, dest);
    } else {
      if (src.node.parent instanceof FrameState) {
        src.node.parent.elements = src.node.parent.elements.filter((e) => e !== src.node);
        src.node.parent = dest.node.parent;
      }
    }

    this.reorder(src, dest);
  };

  reorder = (src: FlatElement, dest: FlatElement) => {
    const result = reorder(src, dest, this.state.flatElements);
    this.setState({ flatElements: result });

    const { settings } = this.props.item;
    settings?.scene.root.reinitializeMoveable();
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
