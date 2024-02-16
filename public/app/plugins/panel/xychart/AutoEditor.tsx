import React, { useEffect, useMemo } from 'react';

import {
  getFrameDisplayName,
  StandardEditorProps,
  getFieldDisplayName,
  FrameMatcherID,
  FieldMatcherID,
  FieldNamePickerBaseNameMode,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { Field, Select } from '@grafana/ui';

import { ScatterSeriesEditor } from './ScatterSeriesEditor';
import { isGraphable } from './dims';
import { Options } from './panelcfg.gen';
import { XYSeriesConfig } from './types2';

export const AutoEditor = ({ value, onChange, context }: StandardEditorProps<XYSeriesConfig[], unknown, Options>) => {
  const frameNames = useMemo(() => {
    if (context?.data?.length) {
      return context.data.map((frame, index) => ({
        value: index,
        label: `${getFrameDisplayName(frame, index)} (index: ${index}, rows: ${frame.length})`,
      }));
    }
    return [{ value: 0, label: 'First result' }];
  }, [context.data]);

  const selected = 0;

  const numberFieldsForSelected = useMemo(() => {
    const numberFields: string[] = [];
    if (!value || !value[selected]) {
      return numberFields;
    }
    const frame = context.data[value[selected].frame?.matcher.options ?? 0];

    if (frame) {
      for (let field of frame.fields) {
        if (isGraphable(field)) {
          const name = getFieldDisplayName(field);
          numberFields.push(name);
        }
      }
    }
    return numberFields;
  }, [context.data, selected, value]);

  // Component-did-mount callback to check if a new series should be created
  useEffect(() => {
    if (!value) {
      // create new series
      const defaultConfig: XYSeriesConfig = { x: { matcher: { id: FieldMatcherID.byName, options: undefined } } };
      onChange([defaultConfig]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    value && (
      <>
        {frameNames.length > 1 && (
          <Field label={'Data'}>
            <Select
              isClearable={true}
              options={frameNames}
              placeholder={'Change filter'}
              value={
                frameNames.find((v) => {
                  return v.value === value[selected].frame?.matcher.options;
                }) ?? null
              }
              onChange={(val) => {
                onChange(
                  value.map((obj, i) => {
                    if (i === selected) {
                      return {
                        ...value[i],
                        frame: {
                          matcher: { id: FrameMatcherID.byIndex, options: val?.value ?? undefined },
                        },
                        x: {
                          matcher: {
                            id: FieldMatcherID.byName,
                            options: numberFieldsForSelected[0],
                          },
                        },
                      };
                    }
                    return obj;
                  })
                );
              }}
            />
          </Field>
        )}
        <ScatterSeriesEditor
          key={`series/${selected}`}
          baseNameMode={FieldNamePickerBaseNameMode.IncludeAll}
          item={{} as StandardEditorsRegistryItem}
          context={context}
          value={value[selected]}
          onChange={(val) => {
            onChange(
              value.map((obj, i) => {
                if (i === selected) {
                  return val!;
                }
                return obj;
              })
            );
          }}
          excludes={true}
          frameFilter={value[selected].frame?.matcher.options ?? undefined}
        />
      </>
    )
  );
};
