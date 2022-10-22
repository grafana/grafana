import { get as lodashGet } from 'lodash';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { DataFrame, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { activePanelSubject, InstanceState } from './CanvasPanel';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
import { addStandardCanvasEditorOptions } from './module';

export function InlineEditBody() {
  const activePanel = useObservable(activePanelSubject);
  const instanceState = activePanel?.panel.context?.instanceState;
  const pane = useMemo(() => {
    const p = activePanel?.panel;
    const state: InstanceState = instanceState;
    if (!state || !p) {
      return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    }

    const supplier = (builder: PanelOptionsEditorBuilder<any>, context: StandardEditorContext<any>) => {
      builder.addNestedOptions(getLayerEditor(instanceState));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (element && !(element instanceof FrameState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [`Selected element (${element.options.name})`],
              element,
              scene: state.scene,
            })
          );
        }
      }

      addStandardCanvasEditorOptions(builder);
    };

    return getOptionsPaneCategoryDescriptor(
      {
        options: p.props.options,
        onChange: p.props.onOptionsChange,
        data: p.props.data?.series,
      },
      supplier
    );
  }, [instanceState, activePanel]);

  const topLevelItemsContainerStyle = {
    marginLeft: 15,
    marginTop: 10,
  };

  return (
    <>
      {pane.categories.map((p) => renderOptionsPaneCategoryDescriptor(p))}
      <div style={topLevelItemsContainerStyle}>{pane.items.map((item) => item.render())}</div>
    </>
  );
}

// Recursively render options
function renderOptionsPaneCategoryDescriptor(pane: OptionsPaneCategoryDescriptor) {
  return (
    <OptionsPaneCategory {...pane.props} key={pane.props.id}>
      <div>{pane.items.map((v) => v.render())}</div>
      {pane.categories.map((c) => renderOptionsPaneCategoryDescriptor(c))}
    </OptionsPaneCategory>
  );
}

interface EditorProps<T> {
  onChange: (v: T) => void;
  options: T;
  data?: DataFrame[];
}

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
