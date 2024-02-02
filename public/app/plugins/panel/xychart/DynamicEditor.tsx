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
    // TODO handle non-new panel
    if (!value?.length || true) {
      // loop through frames
      // create series for each frame
      const newSeries: ScatterSeriesConfig[] = [];
      context.data.map((val, index) => {
        // check for labels, use first one found (for now)
        let label = undefined;
        // TODO turn this into a traditional for loop so we can break out
        val.fields.map((field) => {
          if (field.labels) {
            label = Object.values(field.labels)[0];
          }
        });
        newSeries.push({
          pointColor: undefined,
          pointSize: defaultFieldConfig.pointSize,
          // TODO consider naming based on Query ref instead of series
          name: label ?? `Series ${index + 1}`,
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
          // set x and y fields based on field selectors (same for each series)
          onChange(
            value.map((obj, i) => {
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
        }}
      />
    )
  );
};
