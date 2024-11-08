import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  SelectableValue,
  getFrameDisplayName,
  StandardEditorProps,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { Field, IconButton, Select, useStyles2 } from '@grafana/ui';

import { getXYDimensions, isGraphable } from './dims';
import { XYDimensionConfig, Options } from './panelcfg.gen';

interface XYInfo {
  numberFields: Array<SelectableValue<string>>;
  xAxis?: SelectableValue<string>;
  yFields: Array<SelectableValue<boolean>>;
}

export const AutoEditor = ({ value, onChange, context }: StandardEditorProps<XYDimensionConfig, {}, Options>) => {
  const frameNames = useMemo(() => {
    if (context?.data?.length) {
      return context.data.map((f, idx) => ({
        value: idx,
        label: `${getFrameDisplayName(f, idx)} (index: ${idx}, rows: ${f.length})`,
      }));
    }
    return [{ value: 0, label: 'First result' }];
  }, [context.data]);

  const dims = useMemo(() => getXYDimensions(value, context.data), [context.data, value]);

  const info = useMemo(() => {
    const v: XYInfo = {
      numberFields: [],
      yFields: [],
      xAxis: value?.x
        ? {
            label: `${value.x} (Not found)`,
            value: value.x, // empty
          }
        : undefined,
    };
    const frame = context.data ? context.data[value?.frame ?? 0] : undefined;
    if (frame) {
      const xName = 'x' in dims ? getFieldDisplayName(dims.x, dims.frame, context.data) : undefined;
      for (let field of frame.fields) {
        if (isGraphable(field)) {
          const name = getFieldDisplayName(field, frame, context.data);
          const sel = {
            label: name,
            value: name,
          };
          v.numberFields.push(sel);
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
      if (!v.xAxis) {
        v.xAxis = { label: xName, value: xName };
      }
    }

    return v;
  }, [dims, context.data, value]);

  const styles = useStyles2(getStyles);

  if (!context.data?.length) {
    return <div>No data...</div>;
  }

  return (
    <div>
      <Field label={'Data'}>
        <Select
          isClearable={true}
          options={frameNames}
          placeholder={'Change filter'}
          value={frameNames.find((v) => v.value === value?.frame)}
          onChange={(v) => {
            onChange({
              ...value,
              frame: v?.value!,
              x: undefined,
            });
          }}
        />
      </Field>
      <Field label={'X Field'}>
        <Select
          isClearable={true}
          options={info.numberFields}
          value={info.xAxis}
          placeholder={`${info.numberFields?.[0].label} (First numeric)`}
          onChange={(v) => {
            onChange({
              ...value,
              x: v?.value,
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
                tooltip={v.value ? 'Disable' : 'Enable'}
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
  sorter: css({
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    cursor: 'pointer',
  }),

  row: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    minHeight: theme.spacing(4),
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    marginBottom: '3px',
    border: `1px solid ${theme.components.input.borderColor}`,
  }),
});
