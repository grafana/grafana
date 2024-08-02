import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { onAddItem } from 'app/plugins/panel/canvas/utils';
import { getLayerEditor } from 'app/plugins/panel/geomap/editor/layerEditor';

import { FormConfig, FormElementType, formItem } from '../form';

type Props = StandardEditorProps<FormConfig>;

export const FormElementTypeEditor = ({ value, context, onChange, item }: Props) => {
  const typeOptions = [
    { value: FormElementType.Checkbox, label: 'Checkbox' },
    { value: FormElementType.Radio, label: 'Radio' },
    { value: FormElementType.Select, label: 'Select' },
    { value: FormElementType.TextInput, label: 'Text input' },
    { value: FormElementType.DateRangePicker, label: 'Date range picker' },
  ];

  const { settings } = item;
  const layer = settings.layer;
  //   console.log('item', item);
  //   console.log('layer', layer);

  //   const activePanel = useObservable(activePanelSubject);
  //   const instanceState = activePanel?.panel.context?.instanceState;

  //   console.log('instanceState', instanceState);

  //   const rootLayer: FrameState | undefined = instanceState?.layer;

  //   if (!layer) {
  //     return <div>Missing layer?</div>;
  //   }

  const onElementTypeChange = (sel: SelectableValue<string>) => {
    onChange({ ...value, type: sel.value! as FormElementType });

    // const layer = getLayerEditor(item)

    // return element types
    onAddItem(sel, layer);
  };

  return (
    <AddLayerButton onChange={(sel) => onElementTypeChange(sel)} options={typeOptions} label={'Add element type'} />
    // data, label, value
  );
};
