import { StandardEditorContext, TransformerUIProps, PanelOptionsEditorBuilder } from '@grafana/data';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { set, get as lodashGet } from 'lodash';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { SetGeometryOptions } from './setGeometry';

export function getTransformerOptionPane<T = any>(
  props: TransformerUIProps<SetGeometryOptions>,
  supplier: PanelOptionsSupplier<T>
): OptionsPaneCategoryDescriptor {
  const context: StandardEditorContext<unknown, unknown> = {
    data: props.input,
    options: props.options,
  };

  const root = new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
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

export function getDefaultOptions<T = any>(supplier: PanelOptionsSupplier<T>): T {
  const context: StandardEditorContext<T, unknown> = {
    data: [],
    options: {} as T,
  };

  const results = {};
  const builder = new PanelOptionsEditorBuilder<T>();
  supplier(builder, context);
  for (const item of builder.getItems()) {
    if (item.defaultValue != null) {
      set(results, item.path, item.defaultValue);
    }
  }
  return results as T;
}
