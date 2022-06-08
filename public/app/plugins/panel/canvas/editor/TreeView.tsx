import { css } from '@emotion/css';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
import { FlatElement } from '../tree';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = {
  node: FlatElement;
  parent: FlatElement;
  selection: string[];
  settings: TreeViewEditorProps;
  index: number;
  onToggle: (node: FlatElement) => void;
};

export const TreeView = ({ node, selection, settings, index, parent, onToggle }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const UID = node.node.UID;
  const hasChildren = node.node instanceof FrameState && node.node.elements.length > 0;
  const isSelected = Boolean(selection?.includes(node.node.getName()));

  const nodeStyle = { paddingLeft: (node.depth - 1) * 20 };

  const getSelectedClass = (isSelected: boolean) => {
    return isSelected ? `${styles.treeNodeHeader} ${styles.selected}` : styles.treeNodeHeader;
  };

  const getSvgPath = () => {
    const id = node.node.item.id;
    let path = '';

    switch (id) {
      case 'frame':
        path = `public/img/icons/custom/group.svg`;
        break;
      case 'icon':
        path = node.node.data.path;
        break;
      default:
        path = `public/img/icons/unicons/shape.svg`;
        break;
    }

    return path;
  };

  const onSelectNode = (e: React.MouseEvent<HTMLDivElement>, element: ElementState | FrameState) => {
    e.stopPropagation();
    doSelect(settings, element);
  };

  const onToggleParent = () => {
    onToggle(node);
  };

  return (
    <Draggable key={UID} draggableId={UID.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          key={UID}
          className={getSelectedClass(isSelected)}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div onClick={onToggleParent} className={styles.flex} style={nodeStyle}>
            {hasChildren && <div>{node.isOpen ? <Icon name="angle-down" /> : <Icon name="angle-right" />}</div>}
            <div onClick={(e) => onSelectNode(e, node.node)} className={styles.nodeIcon}>
              <SVG
                src={getSvgPath()}
                className={styles.nodeIconSvg}
                title={'Node Icon'}
                style={{ fill: theme.colors.text.primary }}
              />
              {node.node.getName()}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    treeNodeHeader: css`
      cursor: pointer;
      padding: 8px;

      &:hover {
        background-color: ${theme.colors.border.medium};
      }
    `,
    selected: css`
      background-color: ${theme.colors.border.medium};
    `,
    treeContainer: css`
      list-style: none;
    `,
    nodeIconSvg: css`
      height: 14px;
      width: 14px;
      margin-right: 5px;
      fill: ${theme.colors.text};
    `,
    nodeIcon: css`
      display: flex;
      align-items: center;
    `,
    flex: css`
      display: flex;
    `,
  };
};
