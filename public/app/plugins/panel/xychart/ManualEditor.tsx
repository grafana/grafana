import { css, cx } from '@emotion/css';
import React, { FC, useState } from 'react';

import { GrafanaTheme, StandardEditorProps } from '@grafana/data';
import { Button, IconButton, Label, useStyles } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { LayerName } from 'app/core/components/Layers/LayerName';
import { ColorDimensionConfig, ScaleDimensionConfig } from 'app/features/dimensions';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';

import { XYChartOptions, ScatterSeriesConfig, defaultScatterConfig } from './models.gen';

export const ManualEditor: FC<StandardEditorProps<ScatterSeriesConfig[], any, XYChartOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const [selected, setSelected] = useState<number>(-1);
  const styles = useStyles(getStyles);

  const onXFieldChange = (x: string | undefined, index: number) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, x };
        }
        return obj;
      })
    );
  };

  const onYFieldChange = (y: string | undefined, index: number) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, y };
        }
        return obj;
      })
    );
  };

  const onPointColorChange = (pointColor: ColorDimensionConfig | undefined, index: number) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, pointColor };
        }
        return obj;
      })
    );
  };

  const onPointSizeChange = (pointSize: ScaleDimensionConfig | undefined, index: number) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, pointSize };
        }
        return obj;
      })
    );
  };

  const onNameChange = (name: string, index: number) => {
    onChange(
      value.map((obj, i) => {
        if (i === index) {
          return { ...obj, name };
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
  };

  const onSeriesDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const { options } = context;

  const getRowStyle = (index: number) => {
    return index === selected ? `${styles.row} ${styles.sel}` : styles.row;
  };

  if (options === undefined || !options.series || !options.series.length) {
    return null;
  }

  return (
    <>
      <Button icon="plus" size="sm" variant="secondary" onClick={createNewSeries}>
        Add series
      </Button>
      <br />
      <br />

      {options.series.map((series, index) => {
        return (
          <div key={`series/${index}`} className={getRowStyle(index)} onMouseDown={() => setSelected(index)}>
            <LayerName name={series.name ?? `Series ${index + 1}`} onChange={(v) => onNameChange(v, index)} />

            <IconButton
              name="trash-alt"
              title={'remove'}
              className={cx(styles.actionIcon)}
              onClick={() => onSeriesDelete(index)}
            />
          </div>
        );
      })}
      <br />

      {selected >= 0 && (
        <>
          <div key={`series/${selected}`}>
            <Label>X Field</Label>
            <FieldNamePicker
              value={options.series[selected].x ?? ''}
              context={context}
              onChange={(field) => onXFieldChange(field, selected)}
              item={{} as any}
            />
            <br />
            <Label>Y Field</Label>
            <FieldNamePicker
              value={options.series[selected].y ?? ''}
              context={context}
              onChange={(field) => onYFieldChange(field, selected)}
              item={{} as any}
            />
            <br />
            <Label>Point color</Label>
            <ColorDimensionEditor
              value={options.series[selected].pointColor!}
              context={context}
              onChange={(field) => onPointColorChange(field, selected)}
              item={{} as any}
            />
            <br />
            <Label>Point size</Label>
            <ScaleDimensionEditor
              value={options.series[selected].pointSize!}
              context={context}
              onChange={(field) => onPointSizeChange(field, selected)}
              item={{ settings: { min: 1, max: 50 } } as any}
            />
            <br />
          </div>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
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
