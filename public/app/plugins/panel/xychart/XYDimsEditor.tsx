import React, { FC, useMemo } from 'react';
import { Label, Select } from '@grafana/ui';
import { getFrameDisplayName, StandardEditorProps } from '@grafana/data';

import { defaultXYDimensions, GraphOptions, XYDimensions } from './types';
import { FieldMatcherEditor } from './FieldMatcherEditor';

export const XYDimsEditor: FC<StandardEditorProps<XYDimensions, any, GraphOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const names = useMemo(() => {
    if (context.data && context.data.length > 0) {
      return context.data.map((f, idx) => ({
        value: idx,
        label: getFrameDisplayName(f, idx),
      }));
    }
    return [{ value: 0, label: 'First result' }];
  }, [context.data]);

  return (
    <div>
      <Label>Data</Label>
      <Select
        options={names}
        value={names.find(v => v.value === value?.frame) ?? names[0]}
        onChange={v => {
          onChange({
            ...value,
            frame: v.value,
          });
        }}
      />
      <br />
      <Label>X Fields</Label>
      <FieldMatcherEditor
        value={value?.xFields || defaultXYDimensions.xFields!}
        data={context.data}
        onChange={xFields => onChange({ ...value, xFields })}
      />
      <br />
      <Label>Y Fields</Label>
      <FieldMatcherEditor
        value={value?.yFields || defaultXYDimensions.yFields!}
        data={context.data}
        onChange={yFields => onChange({ ...value, yFields })}
      />
      <br /> <br />
    </div>
  );
};
