import React, { FC, useMemo } from 'react';
import { css } from '@emotion/css';
import { IconButton, Label, Select, stylesFactory, useTheme } from '@grafana/ui';
import {
  SelectableValue,
  getFrameDisplayName,
  GrafanaTheme,
  StandardEditorProps,
  getFieldDisplayName,
} from '@grafana/data';

import { XYDimensionConfig, Options } from './types';
import { getXYDimensions, isGraphable } from './dims';

interface XYInfo {
  numberFields: Array<SelectableValue<string>>;
  xAxis: SelectableValue<string>;
  yFields: Array<SelectableValue<boolean>>;
}

export const XYDimsEditor: FC<StandardEditorProps<XYDimensionConfig, any, Options>> = ({
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

  const dims = useMemo(() => getXYDimensions(value, context.data), [context.data, value]);

  const info = useMemo(() => {
    const first = {
      label: '?',
      value: undefined, // empty
    };
    const v: XYInfo = {
      numberFields: [first],
      yFields: [],
      xAxis: value?.x
        ? {
            label: `${value.x} (Not found)`,
            value: value.x, // empty
          }
        : first,
    };
    const frame = context.data ? context.data[value?.frame ?? 0] : undefined;
    if (frame) {
      const xName = dims.x ? getFieldDisplayName(dims.x, dims.frame, context.data) : undefined;
      for (let field of frame.fields) {
        if (isGraphable(field)) {
          const name = getFieldDisplayName(field, frame, context.data);
          const sel = {
            label: name,
            value: name,
          };
          v.numberFields.push(sel);
          if (first.label === '?') {
            first.label = `${name} (First)`;
          }
          if (value?.x && name === value.x) {
            v.xAxis = sel;
          }
          if (xName !== name) {
            v.yFields.push({
              label: name,
              value: value?.exclude?.includes(name),
            });
          }
        }
      }
    }

    return v;
  }, [dims, context.data, value]);

  const theme = useTheme();
  const styles = getStyles(theme);

  if (!context.data) {
    return <div>No data...</div>;
  }

  return (
    <div>
      <Select
        menuShouldPortal
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
        menuShouldPortal
        options={info.numberFields}
        value={info.xAxis}
        onChange={(v) => {
          onChange({
            ...value,
            x: v.value,
          });
        }}
      />
      <br />
      <Label>Y Fields</Label>
      <div>
        {info.yFields.map((v) => (
          <div key={v.label} className={styles.row}>
            <IconButton
              name={v.value ? 'eye-slash' : 'eye'}
              onClick={() => {
                const exclude: string[] = value?.exclude ? [...value.exclude] : [];
                let idx = exclude.indexOf(v.label!);
                if (idx < 0) {
                  exclude.push(v.label!);
                } else {
                  exclude.splice(idx, 1);
                }
                onChange({
                  ...value,
                  exclude,
                });
              }}
            />
            {v.label}
          </div>
        ))}
      </div>
      <br /> <br />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  sorter: css`
    margin-top: 10px;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    cursor: pointer;
  `,

  row: css`
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    border-radius: ${theme.border.radius.sm};
    background: ${theme.colors.bg2};
    min-height: ${theme.spacing.formInputHeight}px;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    margin-bottom: 3px;
    border: 1px solid ${theme.colors.formInputBorder};
  `,
}));
