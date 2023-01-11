import React, { FC, useMemo } from 'react';

import { SelectableValue, getFrameDisplayName, StandardEditorProps, getFieldDisplayName } from '@grafana/data';
import { Label, Select } from '@grafana/ui';

import { getXYZDimensions } from './dims';
import { XYZDimensionConfig, ScatterPlotOptions } from './models.gen';

interface XYZInfo {
  validFields: Array<SelectableValue<string>>;
  xField: SelectableValue<string>;
}

export const XYZDimsEditor: FC<StandardEditorProps<XYZDimensionConfig, any, ScatterPlotOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const frameNames = useMemo(() => {
    if (context?.data?.length) {
      return context.data.map((f, idx) => ({
        value: idx,
        label: getFrameDisplayName(f, idx),
      }));
    }
    return [{ value: 0, label: 'First result' }];
  }, [context.data]);

  const dims = useMemo(() => getXYZDimensions(value, context.data), [context.data, value]);

  const info = useMemo(() => {
    const first = {
      label: '?',
      value: undefined, // empty
    };
    const v: XYZInfo = {
      validFields: [first],
      xField: value?.x
        ? {
            label: `${value.x} (Not found)`,
            value: value.x, // empty
          }
        : first,
    };

    if (context.data.length === 0) {
      return v;
    }

    const frame = context.data ? context.data[value?.frame ?? 0] : undefined;

    for (let field of dims.frame.fields) {
      const name = getFieldDisplayName(field, frame, context.data);
      const sel = {
        label: name,
        value: name,
      };
      v.validFields.push(sel);
      if (first.label === '?') {
        first.label = `${name} (First)`;
      }
      if (value?.x && name === value.x) {
        v.xField = sel;
      }
    }

    return v;
  }, [dims, context.data, value]);

  if (!context.data) {
    return <div>No data...</div>;
  }

  return (
    <div>
      <Select
        options={frameNames}
        value={frameNames.find((v) => v.value === value?.frame) ?? frameNames[0]}
        onChange={(v) => {
          onChange({
            ...value,
            frame: v.value!,
          });
        }}
      />
      <br />
      <Label>X Field</Label>
      <Select
        options={info.validFields}
        value={info.xField}
        onChange={(v) => {
          onChange({
            ...value,
            x: v.value,
          });
        }}
      />
      <br />
      <br />
    </div>
  );
};
