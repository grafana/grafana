import React, { useEffect } from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode, StandardEditorsRegistryItem } from '@grafana/data';

import { ScatterSeriesEditor } from './ScatterSeriesEditor';
import { Options, ScatterSeriesConfig, defaultFieldConfig } from './panelcfg.gen';

export const DynamicEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ScatterSeriesConfig, unknown, Options>) => {
  // TODO set name of series based on common label value if applicable
  // TODO on data changes, compare and recompute if needed

  // Component-did-mount callback to check if a new series should be created
  useEffect(() => {
    if (!value) {
      // create new series
      const newSeries: ScatterSeriesConfig = { pointColor: undefined, pointSize: defaultFieldConfig.pointSize };
      onChange(newSeries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    value && (
      <ScatterSeriesEditor
        key={`series`}
        baseNameMode={FieldNamePickerBaseNameMode.IncludeAll}
        item={{} as StandardEditorsRegistryItem}
        context={context}
        value={value}
        onChange={(val) => {
          onChange({
            ...val,
            x: val!.x ?? undefined,
            y: val!.y ?? undefined,
            pointColor: val!.pointColor ?? undefined,
            pointSize: val!.pointSize ?? undefined,
          });
        }}
      />
    )
  );
};
