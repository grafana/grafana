import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import {
  SelectableValue,
  getFrameDisplayName,
  StandardEditorProps,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { Field, IconButton, Select, useStyles2 } from '@grafana/ui';

import { getXYDimensions, isGraphable } from './dims';
import { XYDimensionConfig, XYChartOptions } from './models.gen';

interface XYInfo {
  numberFields: Array<SelectableValue<string>>;
  xAxis: SelectableValue<string>;
  yFields: Array<SelectableValue<boolean>>;
}

export const AutoEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<XYDimensionConfig, any, XYChartOptions>) => {
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

  const styles = useStyles2(getStyles);

  if (!context.data) {
    return <div>No data...</div>;
  }

  return (
    <div>
      <Field label={'Data'}>
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
      </Field>
      <Field label={'X Field'}>
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
      </Field>
      <Field label={'Y Fields'}>
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
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sorter: css`
    margin-top: 10px;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    cursor: pointer;
  `,

  row: css`
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.borderRadius(1)};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    margin-bottom: 3px;
    border: 1px solid ${theme.components.input.borderColor};
  `,
});
