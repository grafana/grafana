import { css } from '@emotion/css';
import React, { useState } from 'react';
import SVG from 'react-inlinesvg';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

import appEvents from '../../../../core/app_events';
import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
import { SelectionParams } from '../../../../features/canvas/runtime/scene';

type Props = {
  node: ElementState | FrameState;
  selection: string[];
};

export const TreeNode = ({ node, selection }: Props) => {
  const [isChildVisible, setIsChildVisible] = useState(false);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const hasChildren = node instanceof FrameState;
  const isSelected = Boolean(selection?.includes(node.getName()));
  const elements = hasChildren ? node.elements : [];

  const onSelect = (item: any) => {
    const { settings } = item;

    if (settings?.scene) {
      try {
        let selection: SelectionParams = { targets: [] };
        if (item instanceof FrameState) {
          const targetElements: HTMLDivElement[] = [];
          targetElements.push(item?.div!);
          selection.targets = targetElements;
          selection.frame = item;
          settings.scene.select(selection);
        } else if (item instanceof ElementState) {
          selection.targets = [item?.div!];
          settings.scene.select(selection);
        }
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
      }
    }
  };

  const getRowStyle = (isSelected: boolean) => {
    return isSelected ? `${styles.treeNodeHeader} ${styles.selected}` : styles.treeNodeHeader;
  };

  const getSvgPath = () => {
    const id = node.item.id;
    const uniconsPath = 'public/img/icons/unicons/';
    let path = '';

    switch (id) {
      case 'frame':
        path = `${uniconsPath}apps.svg`;
        break;
      case 'icon':
        path = node.data.path;
        break;
      case 'text-box':
        path = `${uniconsPath}text.svg`;
        break;
      case 'button':
        path = `${uniconsPath}square-shape.svg`;
        break;
      case 'droneTop':
      case 'droneFront':
      case 'droneSide':
        path = 'public/img/icons/iot/drone.svg';
        break;
      case 'windTurbine':
        path = `${uniconsPath}wind.svg`;
        break;
      default:
        // placeholder img
        path = `${uniconsPath}apps.svg`;
        break;
    }

    return path;
  };

  return (
    <li key={node.UID} className={styles.treeNode}>
      <div onClick={() => setIsChildVisible((v) => !v)} className={getRowStyle(isSelected)}>
        {hasChildren && <div>{isChildVisible ? <Icon name="angle-right" /> : <Icon name="angle-down" />}</div>}
        <div onClick={() => onSelect(node)}>
          <SVG
            src={getSvgPath()}
            className={styles.nodeIcon}
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
              return <TreeNode key={element.UID} node={element} selection={selection} />;
            })}
          </ul>
        </div>
      )}
    </li>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    treeNode: css`
      padding: 8px 20px;
    `,
    treeNodeHeader: css`
      display: flex;
    `,
    treeContainer: css`
      list-style: none;
    `,
    selected: css`
      border: 1px solid ${theme.v1.colors.formInputBorderActive};
      &:hover {
        border: 1px solid ${theme.v1.colors.formInputBorderActive};
      }
    `,
    nodeIcon: css`
      height: 14px;
      width: 14px;
      margin-right: 5px;
      fill: ${theme.colors.text};
    `,
  };
};
