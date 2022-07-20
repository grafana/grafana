import { css } from '@emotion/css';
import { get as lodashGet } from 'lodash';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { useStyles2 } from '@grafana/ui';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { activePanelSubject, InstanceState } from './CanvasPanel';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
import { getTreeViewEditor } from './editor/treeViewEditor';

export const InlineEditBody = () => {
  const activePanel = useObservable(activePanelSubject);
  const instanceState = activePanel?.panel.context?.instanceState;

  const styles = useStyles2(getStyles);

  const pane = useMemo(() => {
    const state: InstanceState = instanceState;
    if (!state) {
      return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    }

    const supplier = (builder: PanelOptionsEditorBuilder<any>, context: StandardEditorContext<any>) => {
      builder.addNestedOptions(getTreeViewEditor(state));
      builder.addNestedOptions(getLayerEditor(instanceState));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof FrameState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [`Selected element (${element.options.name})`],
              element,
              scene: state.scene,
            })
          );
        }
      }
    };

    return getOptionsPaneCategoryDescriptor({}, supplier);
  }, [instanceState]);

  return (
    <div>
      <div>{pane.items.map((v) => v.render())}</div>
      <div>
        {pane.categories.map((c) => {
          return (
            <div key={c.props.id} className={styles.wrap}>
              <h5>{c.props.title}</h5>
              <div className={styles.item}>{c.items.map((s) => s.render())}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 🤮🤮🤮🤮 this oddly does not actually do anything, but structure is required.  I'll try to clean it up...
function getOptionsPaneCategoryDescriptor<T = any>(
  props: any,
  supplier: PanelOptionsSupplier<T>
): OptionsPaneCategoryDescriptor {
  const context: StandardEditorContext<unknown, unknown> = {
    data: props.input,
    options: props.options,
  };

  const root = new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
    if (categoryNames?.length) {
      const key = categoryNames[0];
      let sub = root.categories.find((v) => v.props.id === key);
      if (!sub) {
        sub = new OptionsPaneCategoryDescriptor({ id: key, title: key });
        root.categories.push(sub);
      }
      return sub;
    }
    return root;
  };

  const access: NestedValueAccess = {
    getValue: (path: string) => lodashGet(props.options, path),
    onChange: (path: string, value: any) => {
      props.onChange(setOptionImmutably(props.options as any, path, value));
    },
  };

  // Use the panel options loader
  fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context);
  return root;
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css`
    border-top: 1px solid ${theme.colors.border.strong};
    padding: 10px;
  `,
  item: css`
    padding-left: 10px;
  `,
});
