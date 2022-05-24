import { css } from '@emotion/css';
import React, { useState } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = {
  node: ElementState | FrameState;
  selection: string[];
  settings: TreeViewEditorProps;
};

export const TreeNode = ({ node, selection, settings }: Props) => {
  const [isChildVisible, setIsChildVisible] = useState(false);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const hasChildren = node instanceof FrameState;
  const isSelected = Boolean(selection?.includes(node.getName()));
  const elements = hasChildren ? node.elements : [];

  const getRowStyle = (isSelected: boolean) => {
    return isSelected ? `${styles.treeNodeHeader} ${styles.selected}` : styles.treeNodeHeader;
  };

  const getSvgPath = () => {
    const id = node.item.id;
    let path = '';

    switch (id) {
      case 'frame':
        path = `public/img/icons/custom/group.svg`;
        break;
      case 'icon':
        path = node.data.path;
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

  return (
    <li key={node.UID} className={getRowStyle(isSelected)} style={{ paddingLeft: !hasChildren ? '24px' : '' }}>
      <div onClick={() => setIsChildVisible((v) => !v)} className={styles.flex}>
        {hasChildren && <div>{isChildVisible ? <Icon name="angle-down" /> : <Icon name="angle-right" />}</div>}
        <div onClick={(e) => onSelectNode(e, node)} className={styles.nodeIcon}>
          <SVG
            src={getSvgPath()}
            className={styles.nodeIconSvg}
            title={'Node Icon'}
            style={{ fill: theme.colors.text.primary }}
          />
          {node.getName()}
        </div>
      </div>

      {hasChildren && isChildVisible && (
        <div>
          <ul className={styles.treeContainer}>
            {elements.map((element: ElementState | FrameState) => {
              return <TreeNode key={element.UID} node={element} selection={selection} settings={settings} />;
            })}
          </ul>
        </div>
      )}
    </li>
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
