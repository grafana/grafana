import { css, cx } from '@emotion/css';
import React, { useState, useEffect, useMemo } from 'react';

import {
  GrafanaTheme2,
  StandardEditorProps,
  FieldNamePickerBaseNameMode,
  StandardEditorsRegistryItem,
  getFrameDisplayName,
} from '@grafana/data';
import { Button, Field, IconButton, Select, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';

import { ScatterSeriesEditor } from './ScatterSeriesEditor';
import { Options, ScatterSeriesConfig, defaultFieldConfig } from './panelcfg.gen';

export const ManualEditor = ({
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

  const [selected, setSelected] = useState(0);
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

  const createNewSeries = () => {
    onChange([
      ...value,
      {
        pointColor: undefined,
        pointSize: defaultFieldConfig.pointSize,
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
            <div
              key={`series/${index}`}
              className={getRowStyle(index)}
              onClick={() => setSelected(index)}
              role="button"
              aria-label={`Select series ${index + 1}`}
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setSelected(index);
                }
              }}
            >
              <LayerName
                name={series.name ?? `Series ${index + 1}`}
                onChange={(v) => onFieldChange(v, index, 'name')}
              />

              <IconButton
                name="trash-alt"
                title={'remove'}
                className={cx(style.actionIcon)}
                onClick={() => onSeriesDelete(index)}
                tooltip="Delete series"
              />
            </div>
          );
        })}
      </div>

      {selected >= 0 && value[selected] && (
        <>
          {frameNames.length > 1 && (
            <Field label={'Data'}>
              <Select
                isClearable={false}
                options={frameNames}
                placeholder={'Change filter'}
                value={
                  frameNames.find((v) => {
                    return v.value === value[selected].frame;
                  }) ?? 0
                }
                onChange={(val) => {
                  onChange(
                    value.map((obj, i) => {
                      if (i === selected) {
                        if (val === null) {
                          return { ...value[i], frame: undefined };
                        }
                        return { ...value[i], frame: val?.value!, x: undefined, y: undefined };
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
            baseNameMode={FieldNamePickerBaseNameMode.ExcludeBaseNames}
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
            frameFilter={value[selected].frame ?? undefined}
          />
        </>
      )}
    </>
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
