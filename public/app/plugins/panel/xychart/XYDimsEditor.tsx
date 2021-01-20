import React, { FC, useCallback, useMemo } from 'react';
import { css } from 'emotion';
import { IconButton, Label, Select, stylesFactory, Switch, useTheme } from '@grafana/ui';
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
  if (!context.data) {
    return <div>No data...</div>;
  }

  const frameNames = useMemo(() => {
    if (context.data && context.data.length > 0) {
      return context.data.map((f, idx) => ({
        value: idx,
        label: getFrameDisplayName(f, idx),
      }));
    }
    return [{ value: 0, label: 'First result' }];
  }, [context.data, value?.frame]);

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
      const xName = getFieldDisplayName(dims.x, dims.frame, context.data);
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

  const toggleSort = useCallback(() => {
    onChange({
      ...value,
      sort: !value?.sort,
    });
  }, [value, onChange]);

  const theme = useTheme();
  const styles = getStyles(theme);

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
        options={info.numberFields}
        value={info.xAxis}
        onChange={(v) => {
          onChange({
            ...value,
            x: v.value,
          });
        }}
      />
      <div className={styles.sorter}>
        <Switch value={value?.sort ?? false} onClick={toggleSort} />
        <div onClick={toggleSort}>&nbsp; Sort field</div>
      </div>
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
