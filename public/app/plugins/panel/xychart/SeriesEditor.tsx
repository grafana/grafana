import { css, cx } from '@emotion/css';
import { Fragment, useState } from 'react';
import { usePrevious } from 'react-use';

import {
  getFrameDisplayName,
  StandardEditorProps,
  // getFieldDisplayName,
  FrameMatcherID,
  FieldMatcherID,
  FieldNamePickerBaseNameMode,
  FieldType,
  GrafanaTheme2,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, IconButton, Select, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { LayerName } from 'app/core/components/Layers/LayerName';

import { Options, SeriesMapping, XYSeriesConfig } from './panelcfg.gen';

export const SeriesEditor = ({
  value: seriesCfg,
  onChange,
  context,
}: StandardEditorProps<XYSeriesConfig[], unknown, Options>) => {
  const style = useStyles2(getStyles);

  // reset opts when mapping changes (no way to do this in panel opts builder?)
  const mapping = context.options?.mapping;
  const prevMapping = usePrevious(mapping);
  const mappingChanged = prevMapping != null && mapping !== prevMapping;

  const defaultFrame = { frame: { matcher: { id: FrameMatcherID.byIndex, options: 0 } } };
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (mappingChanged || seriesCfg == null) {
    seriesCfg = [{ ...defaultFrame }];
    onChange([...seriesCfg]);

    if (selectedIdx > 0) {
      setSelectedIdx(0);
    }
  }

  const addSeries = () => {
    seriesCfg = seriesCfg.concat({ ...defaultFrame });
    setSelectedIdx(seriesCfg.length - 1);
    onChange([...seriesCfg]);
  };

  const deleteSeries = (index: number) => {
    seriesCfg = seriesCfg.filter((s, i) => i !== index);
    setSelectedIdx(0);
    onChange([...seriesCfg]);
  };

  const series = seriesCfg[selectedIdx];
  const formKey = `${mapping}${selectedIdx}`;

  const baseNameMode =
    mapping === SeriesMapping.Manual
      ? FieldNamePickerBaseNameMode.ExcludeBaseNames
      : context.data.length === 1
        ? FieldNamePickerBaseNameMode.IncludeAll
        : FieldNamePickerBaseNameMode.OnlyBaseNames;

  context.data.forEach((frame, frameIndex) => {
    frame.fields.forEach((field, fieldIndex) => {
      field.state = {
        ...field.state,
        origin: {
          frameIndex,
          fieldIndex,
        },
      };
    });
  });

  return (
    <>
      {mapping === SeriesMapping.Manual && (
        <>
          <Button icon="plus" size="sm" variant="secondary" onClick={addSeries} className={style.marginBot}>
            <Trans i18nKey="xychart.series-editor.add-series">Add series</Trans>
          </Button>

          <div className={style.marginBot}>
            {seriesCfg.map((series, index) => {
              return (
                <div
                  key={`series/${index}`}
                  className={index === selectedIdx ? `${style.row} ${style.sel}` : style.row}
                  onClick={() => setSelectedIdx(index)}
                  role="button"
                  aria-label={t('xychart.series-editor.aria-label-select-series', 'Select series {{seriesNum}}', {
                    seriesNum: index + 1,
                  })}
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedIdx(index);
                    }
                  }}
                >
                  <LayerName
                    name={series.name?.fixed ?? `Series ${index + 1}`}
                    onChange={(v) => {
                      series.name = {
                        fixed: v === '' || v === `Series ${index + 1}` ? undefined : v,
                      };
                      onChange([...seriesCfg]);
                    }}
                  />
                  <IconButton
                    name="trash-alt"
                    className={cx(style.actionIcon)}
                    onClick={() => deleteSeries(index)}
                    tooltip={t('xychart.series-editor.tooltip-delete-series', 'Delete series')}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedIdx >= 0 && series != null && (
        <Fragment key={formKey}>
          <Field label={t('xychart.series-editor.label-frame', 'Frame')}>
            <Select
              placeholder={
                mapping === SeriesMapping.Auto
                  ? t('xychart.series-editor.placeholder-all-frames', 'All frames')
                  : t('xychart.series-editor.placeholder-select-frame', 'Select frame')
              }
              isClearable={true}
              options={context.data.map((frame, index) => ({
                value: index,
                label: `${getFrameDisplayName(frame, index)} (index: ${index}, rows: ${frame.length})`,
              }))}
              value={series.frame?.matcher.options}
              onChange={(opt) => {
                if (opt == null) {
                  delete series.frame;
                } else {
                  series.frame = {
                    matcher: {
                      id: FrameMatcherID.byIndex,
                      options: Number(opt.value),
                    },
                  };
                }

                onChange([...seriesCfg]);
              }}
            />
          </Field>
          <Field label={t('xychart.series-editor.label-x-field', 'X field')}>
            <FieldNamePicker
              value={series.x?.matcher.options as string}
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
                  filter: (field) =>
                    (mapping === SeriesMapping.Auto ||
                      field.state?.origin?.frameIndex === series.frame?.matcher.options) &&
                    (field.type === FieldType.number || field.type === FieldType.time) &&
                    !field.config.custom?.hideFrom?.viz,
                  baseNameMode,
                  placeholderText:
                    mapping === SeriesMapping.Auto
                      ? t('xychart.series-editor.placeholder-x-field', 'First number or time field in each frame')
                      : undefined,
                },
              }}
            />
          </Field>
          <Field label={t('xychart.series-editor.label-y-field', 'Y field')}>
            <FieldNamePicker
              value={series.y?.matcher?.options as string}
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
                  filter: (field) =>
                    (mapping === SeriesMapping.Auto ||
                      field.state?.origin?.frameIndex === series.frame?.matcher.options) &&
                    field.type === FieldType.number &&
                    !field.config.custom?.hideFrom?.viz,
                  baseNameMode,
                  placeholderText:
                    mapping === SeriesMapping.Auto
                      ? t('xychart.series-editor.placeholder-y-field', 'Remaining number fields in each frame')
                      : undefined,
                },
              }}
            />
          </Field>
          <Field label={t('xychart.series-editor.label-size-field', 'Size field')}>
            <FieldNamePicker
              value={series.size?.matcher?.options as string}
              context={context}
              onChange={(fieldName) => {
                if (fieldName == null) {
                  delete series.size;
                } else {
                  // TODO: reset any other dim that was set to fieldName
                  series.size = {
                    matcher: {
                      id: FieldMatcherID.byName,
                      options: fieldName,
                    },
                  };
                }

                onChange([...seriesCfg]);
              }}
              item={{
                id: 'size',
                name: 'size',
                settings: {
                  // TODO: filter out series.y?.exclude.options, series.size.matcher.options, series.color.matcher.options
                  filter: (field) =>
                    (mapping === SeriesMapping.Auto ||
                      field.state?.origin?.frameIndex === series.frame?.matcher.options) &&
                    field.type === FieldType.number &&
                    !field.config.custom?.hideFrom?.viz,
                  baseNameMode,
                  placeholderText: '',
                },
              }}
            />
          </Field>
          <Field label={t('xychart.series-editor.label-color-field', 'Color field')}>
            <FieldNamePicker
              value={series.color?.matcher?.options as string}
              context={context}
              onChange={(fieldName) => {
                if (fieldName == null) {
                  delete series.color;
                } else {
                  // TODO: reset any other dim that was set to fieldName
                  series.color = {
                    matcher: {
                      id: FieldMatcherID.byName,
                      options: fieldName,
                    },
                  };
                }

                onChange([...seriesCfg]);
              }}
              item={{
                id: 'color',
                name: 'color',
                settings: {
                  // TODO: filter out series.y?.exclude.options, series.size.matcher.options, series.color.matcher.options
                  filter: (field) =>
                    (mapping === SeriesMapping.Auto ||
                      field.state?.origin?.frameIndex === series.frame?.matcher.options) &&
                    field.type === FieldType.number &&
                    !field.config.custom?.hideFrom?.viz,
                  baseNameMode,
                  placeholderText: '',
                },
              }}
            />
          </Field>
        </Fragment>
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
