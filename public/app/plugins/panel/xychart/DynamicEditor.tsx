import React, { useEffect } from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode, StandardEditorsRegistryItem } from '@grafana/data';

import { ScatterSeriesEditor } from './ScatterSeriesEditor';
import { Options, ScatterSeriesConfig, defaultFieldConfig } from './panelcfg.gen';

export const DynamicEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ScatterSeriesConfig[], unknown, Options>) => {
  const selected = 0;

  // TODO set name of series based on common label value if applicable
  // TODO on data changes, compare and recompute if needed

  // Component-did-mount callback to check if a new series should be created
  useEffect(() => {
    if (!value?.length) {
      // loop through frames
      // create series for each frame
      const newSeries: ScatterSeriesConfig[] = [];
      context.data.map((val, index) => {
        console.log(val, index);
        newSeries.push({
          pointColor: undefined,
          pointSize: defaultFieldConfig.pointSize,
          name: val.name ?? `Series ${index + 1}`,
          frame: index,
          axisLabel: 'test',
        });
      });
      onChange(newSeries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(context.data);
  }, [context.data]);

  useEffect(() => {
    console.log(value);
  }, [value]);

  return (
    selected >= 0 &&
    value[selected] && (
      <ScatterSeriesEditor
        key={`series/${selected}`}
        baseNameMode={FieldNamePickerBaseNameMode.IncludeAll}
        item={{} as StandardEditorsRegistryItem}
        context={context}
        value={value[selected]}
        onChange={(val) => {
          console.log(val);
          // set x and y fields based on field selectors (same for each series)
          onChange(
            value.map((obj, i) => {
              console.log(obj, i);
              const newObj = {
                ...obj,
                x: val!.x ?? undefined,
                y: val!.y ?? undefined,
                pointColor: val!.pointColor ?? undefined,
                pointSize: val!.pointSize ?? undefined,
              };
              return newObj;
            })
          );
          console.log(value);
        }}
      />
    )
  );
};
