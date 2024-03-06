import { css } from '@emotion/css';
import React from 'react';

import {
  StandardEditorProps,
  FieldNamePickerBaseNameMode,
  FieldMatcherID,
  GrafanaTheme2,
  getFieldDisplayName,
  SelectableValue,
} from '@grafana/data';
import { Field, IconButton, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { isGraphable } from './dims';
import { Options } from './panelcfg.gen';
import { XYSeriesConfig } from './types2';

export interface Props extends StandardEditorProps<XYSeriesConfig, unknown, Options> {
  baseNameMode: FieldNamePickerBaseNameMode;
  excludes: boolean;
  frameFilter?: number;
}

type yFields = Array<SelectableValue<boolean>>;

export const ScatterSeriesEditor = ({ value, onChange, context, baseNameMode, excludes, frameFilter = -1 }: Props) => {
  const onFieldChange = (val: any | undefined, field: string) => {
    if (val) {
      onChange({
        ...value,
        [field]: {
          matcher: { id: FieldMatcherID.byName, options: val },
        },
      });
    } else {
      onChange({ ...value, [field]: undefined });
    }
  };

  let frame = context.data && frameFilter > -1 ? context.data[frameFilter] : undefined;

  const styles = useStyles2(getStyles);

  const xName = value.x?.matcher.options;
  const yFields: yFields = [];
  if (frame) {
    for (let field of frame.fields) {
      if (isGraphable(field)) {
        const name = getFieldDisplayName(field, frame, context.data);
        if (xName !== name) {
          yFields.push({
            label: name,
            value: value?.y?.exclude?.options.includes(name),
          });
        }
      }
    }
  } else {
    for (let frame of context.data) {
      for (let field of frame.fields) {
        if (isGraphable(field)) {
          const name = getFieldDisplayName(field, frame, context.data);
          if (xName !== name) {
            yFields.push({
              label: name,
              value: value?.y?.exclude?.options.includes(name),
            });
          }
        }
      }
    }
  }

  return (
    <div>
      <Field label={'X Field'}>
        <FieldNamePicker
          value={value.x?.matcher.options}
          context={context}
          onChange={(field) =>
            onChange({
              ...value,
              x: {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: field,
                },
              },
            })
          }
          item={{
            id: 'x',
            name: 'x',
            settings: {
              filter: (field) => {
                return frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true;
              },
              baseNameMode,
              placeholderText: 'select X field',
            },
          }}
        />
      </Field>
      {excludes ? (
        <Field label={'Y Fields'}>
          <div>
            {yFields.map((v) => (
              <div key={v.label} className={styles.row}>
                <IconButton
                  name={v.value ? 'eye-slash' : 'eye'}
                  onClick={() => {
                    const exclude: string[] = value?.y?.exclude ? [...value.y.exclude.options] : [];
                    let idx = exclude.indexOf(v.label!);
                    if (idx < 0) {
                      exclude.push(v.label!);
                    } else {
                      exclude.splice(idx, 1);
                    }
                    onChange({
                      ...value,
                      y: {
                        exclude: {
                          id: FieldMatcherID.byNames,
                          options: exclude,
                        },
                      },
                    });
                  }}
                  tooltip={v.value ? 'Disable' : 'Enable'}
                />
                {v.label}
              </div>
            ))}
          </div>
        </Field>
      ) : (
        <Field label={'Y Field'}>
          <FieldNamePicker
            value={value.y?.matcher?.options ?? ''}
            context={context}
            onChange={(field) =>
              onChange({
                ...value,
                y: {
                  matcher: {
                    id: FieldMatcherID.byName,
                    options: field,
                  },
                },
              })
            }
            item={{
              id: 'y',
              name: 'y',
              settings: {
                filter: (field) =>
                  frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
                baseNameMode,
                placeholderText: 'select Y field',
              },
            }}
          />
        </Field>
      )}
      <Field label={'Color field'}>
        <FieldNamePicker
          value={value.color ? value.color?.matcher.options : undefined}
          context={context}
          onChange={(field) => onFieldChange(field, 'color')}
          item={{
            id: 'color',
            name: 'color',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              isClearable: true,
              placeholderText: 'Use default color scheme or field config',
            },
          }}
        />
      </Field>
      <Field label={'Size field'}>
        <FieldNamePicker
          value={value.size ? value.size?.matcher.options : undefined}
          context={context}
          onChange={(field) => onFieldChange(field, 'size')}
          item={{
            id: 'size',
            name: 'size',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              isClearable: true,
              placeholderText: 'Use default size or field config',
            },
          }}
        />
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
