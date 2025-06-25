import { css } from '@emotion/css';
import { get as lodashGet } from 'lodash';
import { useMemo, useState } from 'react';
import { useObservable } from 'react-use';

import { DataFrame, GrafanaTheme2, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { NestedValueAccess, PanelOptionsSupplier } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { activePanelSubject, InstanceState } from '../../CanvasPanel';
import { addStandardCanvasEditorOptions } from '../../module';
import { Options } from '../../panelcfg.gen';
import { InlineEditTabs } from '../../types';
import { getElementTypes, onAddItem } from '../../utils';
import { getConnectionEditor } from '../connectionEditor';
import { getElementEditor } from '../element/elementEditor';
import { getLayerEditor } from '../layer/layerEditor';

import { TabsEditor } from './TabsEditor';

export function InlineEditBody() {
  const activePanel = useObservable(activePanelSubject);
  const instanceState = activePanel?.panel.context?.instanceState;
  const styles = useStyles2(getStyles);

  const [activeTab, setActiveTab] = useState<string>(InlineEditTabs.SelectedElement);

  const pane = useMemo(() => {
    const p = activePanel?.panel;
    const state: InstanceState = instanceState;
    if (!(state && state.scene) || !p) {
      return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    }

    const supplier = (builder: PanelOptionsEditorBuilder<Options>) => {
      if (activeTab === InlineEditTabs.ElementManagement) {
        builder.addNestedOptions(getLayerEditor(instanceState));
      }

      const selectedConnection = state.selectedConnection;
      if (selectedConnection && activeTab === InlineEditTabs.SelectedElement) {
        builder.addNestedOptions(
          getConnectionEditor({
            category: [`Selected connection`],
            connection: selectedConnection,
            scene: state.scene,
          })
        );
      }

      const selection = state.selected;
      if (selection?.length === 1 && activeTab === InlineEditTabs.SelectedElement) {
        const element = selection[0];
        if (element && !(element instanceof FrameState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [
                t('canvas.inline-edit-body.category-selected-element', 'Selected element ({{element}})', {
                  element: element.options.name,
                }),
              ],
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
  }, [instanceState, activePanel, activeTab]);

  const topLevelItemsContainerStyle = {
    marginLeft: 15,
    marginTop: 10,
  };

  const onTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const typeOptions = getElementTypes(instanceState?.scene.shouldShowAdvancedTypes).options;
  const rootLayer: FrameState | undefined = instanceState?.layer;

  const noElementSelected =
    instanceState &&
    activeTab === InlineEditTabs.SelectedElement &&
    instanceState.selected.length === 0 &&
    instanceState.selectedConnection === undefined;

  return (
    <>
      <div style={topLevelItemsContainerStyle}>{pane.items.map((item) => item.render())}</div>
      <div style={topLevelItemsContainerStyle}>
        <AddLayerButton
          onChange={(sel) => onAddItem(sel, rootLayer)}
          options={typeOptions}
          label={t('canvas.inline-edit-body.label-add-item', 'Add item')}
        />
      </div>
      <div style={topLevelItemsContainerStyle}>
        <TabsEditor onTabChange={onTabChange} />
        {pane.categories.map((p) => renderOptionsPaneCategoryDescriptor(p))}
        {noElementSelected && (
          <div className={styles.selectElement}>
            <Trans i18nKey="canvas.inline-edit-body.please-select-an-element">Please select an element</Trans>
          </div>
        )}
      </div>
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

function getOptionsPaneCategoryDescriptor<T extends object>(
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
    getValue: (path) => lodashGet(props.options, path),
    onChange: (path, value) => {
      props.onChange(setOptionImmutably<T>(props.options, path, value));
    },
  };

  // Use the panel options loader
  fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context);
  return root;
}

const getStyles = (theme: GrafanaTheme2) => ({
  selectElement: css({
    color: theme.colors.text.secondary,
    padding: theme.spacing(2),
  }),
});
