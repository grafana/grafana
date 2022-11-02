import { css, cx } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme, StandardEditorProps } from '@grafana/data';
import { Button, Field, IconButton, useStyles } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { LayerName } from 'app/core/components/Layers/LayerName';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';

import { XYChartOptions, ScatterSeriesConfig, defaultScatterConfig } from './models.gen';

export const ManualEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ScatterSeriesConfig[], any, XYChartOptions>) => {
  const [selected, setSelected] = useState<number>(0);
  const style = useStyles(getStyles);

  const onFieldChange = (val: any | undefined, index: number, field: string) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, [field]: val };
        }
        return obj;
      })
    );
  };

  const createNewSeries = () => {
    onChange([
      ...value,
      {
        pointColor: {} as any,
        pointSize: defaultScatterConfig.pointSize,
      },
    ]);
    setSelected(value.length);
  };

  // Component-did-mount callback to check if a new series should be created
  useEffect(() => {
    if (!value?.length) {
      createNewSeries(); // adds a new series
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

  return (
    <>
      <Button icon="plus" size="sm" variant="secondary" onClick={createNewSeries} className={style.marginBot}>
        Add series
      </Button>

      <div className={style.marginBot}>
        {value.map((series, index) => {
          return (
            <div key={`series/${index}`} className={getRowStyle(index)} onMouseDown={() => setSelected(index)}>
              <LayerName
                name={series.name ?? `Series ${index + 1}`}
                onChange={(v) => onFieldChange(v, index, 'name')}
              />

              <IconButton
                name="trash-alt"
                title={'remove'}
                className={cx(style.actionIcon)}
                onClick={() => onSeriesDelete(index)}
              />
            </div>
          );
        })}
      </div>

      {selected >= 0 && value[selected] && (
        <>
          <div key={`series/${selected}`}>
            <Field label={'X Field'}>
              <FieldNamePicker
                value={value[selected].x ?? ''}
                context={context}
                onChange={(field) => onFieldChange(field, selected, 'x')}
                item={{} as any}
              />
            </Field>
            <Field label={'Y Field'}>
              <FieldNamePicker
                value={value[selected].y ?? ''}
                context={context}
                onChange={(field) => onFieldChange(field, selected, 'y')}
                item={{} as any}
              />
            </Field>
            <Field label={'Point color'}>
              <ColorDimensionEditor
                value={value[selected].pointColor!}
                context={context}
                onChange={(field) => onFieldChange(field, selected, 'pointColor')}
                item={{} as any}
              />
            </Field>
            <Field label={'Point size'}>
              <ScaleDimensionEditor
                value={value[selected].pointSize!}
                context={context}
                onChange={(field) => onFieldChange(field, selected, 'pointSize')}
                item={{ settings: { min: 1, max: 100 } } as any}
              />
            </Field>
          </div>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  marginBot: css`
    margin-bottom: 20px;
  `,
  row: css`
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    border-radius: ${theme.border.radius.sm};
    background: ${theme.colors.bg2};
    min-height: ${theme.spacing.formInputHeight}px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3px;
    cursor: pointer;

    border: 1px solid ${theme.colors.formInputBorder};
    &:hover {
      border: 1px solid ${theme.colors.formInputBorderHover};
    }
  `,
  sel: css`
    border: 1px solid ${theme.colors.formInputBorderActive};
    &:hover {
      border: 1px solid ${theme.colors.formInputBorderActive};
    }
  `,
  actionIcon: css`
    color: ${theme.colors.textWeak};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
});
