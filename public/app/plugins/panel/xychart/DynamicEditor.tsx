import { css, cx } from '@emotion/css';
import React, { useState, useEffect, useMemo } from 'react';

import {
  GrafanaTheme2,
  StandardEditorProps,
  FieldNamePickerBaseNameMode,
  StandardEditorsRegistryItem,
  getFrameDisplayName,
} from '@grafana/data';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';

import { ScatterSeriesEditor } from './ScatterSeriesEditor';
import { Options, ScatterSeriesConfig, defaultFieldConfig } from './panelcfg.gen';

export const DynamicEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ScatterSeriesConfig[], unknown, Options>) => {
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
  const style = useStyles2(getStyles);

  const onFieldChange = (val: unknown | undefined, index: number, field: string) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, [field]: val };
        }
        return obj;
      })
    );
  };

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

  const onSeriesDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  // const { options } = context;

  const getRowStyle = (index: number) => {
    return index === selected ? `${style.row} ${style.sel}` : style.row;
  };

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

const getStyles = (theme: GrafanaTheme2) => ({
  marginBot: css({
    marginBottom: '20px',
  }),
  row: css({
    padding: `${theme.spacing(0.5, 1)}`,
    borderRadius: `${theme.shape.radius.default}`,
    background: `${theme.colors.background.secondary}`,
    minHeight: `${theme.spacing(4)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '3px',
    cursor: 'pointer',

    border: `1px solid ${theme.components.input.borderColor}`,
    '&:hover': {
      border: `1px solid ${theme.components.input.borderHover}`,
    },
  }),
  sel: css({
    border: `1px solid ${theme.colors.primary.border}`,
    '&:hover': {
      border: `1px solid ${theme.colors.primary.border}`,
    },
  }),
  actionIcon: css({
    color: `${theme.colors.text.secondary}`,
    '&:hover': {
      color: `${theme.colors.text}`,
    },
  }),
});
