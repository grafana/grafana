import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { StandardEditorProps } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
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

    return (
      <div>
        {elements.map((element: ElementState | FrameState) => {
          if (element == null) {
            return null;
          }

          return (
            <div key={element.UID}>
              <ul className={styles.treeListContainer}>
                <TreeNode node={element} selection={selection} settings={settings} />
              </ul>
            </div>
          );
        })}
      </div>
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
