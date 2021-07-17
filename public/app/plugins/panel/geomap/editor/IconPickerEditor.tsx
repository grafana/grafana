import React, { FC, useCallback } from 'react';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { Select } from '@grafana/ui';
import { shapes } from '../utils/regularShapes';

export const IconPickerEditor: FC<StandardEditorProps<string | undefined, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const shapesArr = shapes(context);
  const onSelectChange = useCallback(
    (option: SelectableValue) => {
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
