import { css } from '@emotion/css';
import { get as lodashGet } from 'lodash';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { DataFrame, GrafanaTheme2, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
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
import { of } from 'rxjs';

export const InlineEditBody = () => {
  const activePanel = useObservable(activePanelSubject);
  const instanceState = activePanel?.panel.context?.instanceState;
  const panelData = useObservable(activePanel?.panel?.data ?? of());

  const styles = useStyles2(getStyles);

  const pane = useMemo(() => {
    const p = activePanel?.panel;
    const state: InstanceState = instanceState;
    if (!state || !p) {
      return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    }

    const supplier = (builder: PanelOptionsEditorBuilder<any>, context: StandardEditorContext<any>) => {
      builder.addNestedOptions(getTreeViewEditor(state));
      builder.addNestedOptions(getLayerEditor(instanceState));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof FrameState)) {
          console.log("HERE", element);
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

    return getOptionsPaneCategoryDescriptor({ 
        options: p.props.options, 
        onChange: p.props.onOptionsChange,
        data: p.props.data.series,
     }, supplier);
  }, [instanceState, panelData]);

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

interface EditorProps<T> {
  onChange: (v:T) => void;
  options: T;
  data?: DataFrame[];
}

// 🤮🤮🤮🤮 this oddly does not actually do anything, but structure is required.  I'll try to clean it up...
function getOptionsPaneCategoryDescriptor<T = any>(
  props: EditorProps<T>,
  supplier: PanelOptionsSupplier<T>
): OptionsPaneCategoryDescriptor {
  const context: StandardEditorContext<unknown, unknown> = {
    data: props.data ?? [],
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
