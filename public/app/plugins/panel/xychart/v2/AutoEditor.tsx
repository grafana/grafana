import React, { useMemo } from 'react';

import {
  getFrameDisplayName,
  StandardEditorProps,
  getFieldDisplayName,
  FrameMatcherID,
  FieldMatcherID,
  FieldNamePickerBaseNameMode,
  FieldType,
} from '@grafana/data';
import { Field, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { Options } from '../panelcfg.gen';
import { XYSeriesConfig } from '../types2';

import { prepSeries } from './utils';

export const AutoEditor = ({
  value: seriesCfg,
  onChange,
  context,
}: StandardEditorProps<XYSeriesConfig[], unknown, Options>) => {
  // // matched series (plus excluded?)
  // const xySeries = useMemo(() => {
  //   return prepSeries(SeriesMapping.Auto, seriesCfg, context.data);
  // }, [seriesCfg, context.data]);

  // console.log(xySeries);

  // matched frames
  // matched xFields
  // matched sizeFields
  // matched colorFields
  // excluded yFields
  // matched yFields

  return seriesCfg.map((series, i) => (
    <div key={i}>
      <Field label="Frame #">
        <Select
          isClearable={true}
          options={context.data.map((frame, index) => ({
            value: index,
            label: `${getFrameDisplayName(frame, index)} (index: ${index}, rows: ${frame.length})`,
          }))}
          value={series.frame?.matcher.options}
          onChange={(index) => {
            if (index == null) {
              delete series.frame;
            } else {
              series.y = {
                matcher: {
                  id: FrameMatcherID.byIndex,
                  options: index,
                },
              };
            }

            onChange([...seriesCfg]);
          }}
        />
      </Field>
      <Field label="X field">
        <FieldNamePicker
          value={series.x?.matcher.options}
          context={context}
          onChange={(fieldName) => {
            if (fieldName == null) {
              delete series.x;
            } else {
              // TODO: reset any other dim that was set to fieldName
              series.x = {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: fieldName,
                },
              };
            }

            onChange([...seriesCfg]);
          }}
          item={{
            id: 'x',
            name: 'x',
            settings: {
              filter: (field) => field.type === FieldType.number,
              baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
              placeholderText: 'First number field in each frame',
            },
          }}
        />
      </Field>
      <Field label="Y field">
        <>
          <FieldNamePicker
            value={series.y?.matcher?.options}
            context={context}
            onChange={(fieldName) => {
              if (fieldName == null) {
                delete series.y;
              } else {
                // TODO: reset any other dim that was set to fieldName
                series.y = {
                  matcher: {
                    id: FieldMatcherID.byName,
                    options: fieldName,
                  },
                };
              }

              onChange([...seriesCfg]);
            }}
            item={{
              id: 'y',
              name: 'y',
              settings: {
                // TODO: filter out series.y?.exclude.options, series.size.matcher.options, series.color.matcher.options
                filter: (field) => field.type === FieldType.number && field.name !== series.x?.matcher.options,
                baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
                placeholderText: 'Remaining number fields in each frame',
              },
            }}
          />
          {/* <FieldNamePicker
              value={series.y?.exclude?.options}
              context={context}
              onChange={(fieldName) => {
                if (fieldName == null) {
                  delete series.y;
                } else {
                  series.y = {
                    matcher: {
                      id: FieldMatcherID.byNames,
                      options: fieldName,
                    },
                  };
                }

                onChange([...value]);
              }}
              item={{
                id: 'yExclude',
                name: 'yExclude',
                settings: {
                  filter: (field) => field.type === FieldType.number,
                  baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
                },
              }}
            /> */}
        </>
      </Field>
    </div>
  ));
};
