import React, { FC, useCallback } from 'react';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { Select } from '@grafana/ui';
import { Style } from 'ol/style';
import { shapes } from '../utils/regularShapes';
interface Shapes {
  label: string;
  value: Style;
}
export const IconPickerEditor: FC<StandardEditorProps<string | undefined, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const shapesArr = shapes();
  const onSelectChange = useCallback(
    (option: Shapes) => {
      onChange(option.label);
    },
    [onChange]
  );
  return (
    <>
      <Select value={value} options={shapesArr} onChange={onSelectChange} />
    </>
  );
};
