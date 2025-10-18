import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useCallback, useEffect, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2, MappingType, SpecialValueMatch, SelectableValue, ValueMappingResult } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, Icon, Select, ColorPicker, IconButton, Input, Button, Stack } from '@grafana/ui';

import { ResourcePickerSize, ResourceFolderName, MediaType } from '../../types';
import { ResourcePicker } from '../ResourcePicker';

export interface ValueMappingEditRowModel {
  type: MappingType;
  from?: number | null;
  to?: number | null;
  pattern?: string;
  key?: string;
  isNew?: boolean;
  specialMatch?: SpecialValueMatch;
  result: ValueMappingResult;
  id: string;
}

interface Props {
  mapping: ValueMappingEditRowModel;
  index: number;
  onChange: (index: number, mapping: ValueMappingEditRowModel) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  showIconPicker?: boolean;
}

export function ValueMappingEditRow({ mapping, index, onChange, onRemove, onDuplicate, showIconPicker }: Props) {
  const { key, result, id } = mapping;
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const update = useCallback(
    (fn: (item: ValueMappingEditRowModel) => void) => {
      const copy = {
        ...mapping,
        result: {
          ...mapping.result,
        },
      };
      fn(copy);
      onChange(index, copy);
    },
    [mapping, index, onChange]
  );

  useEffect(() => {
    if (inputRef.current && mapping.isNew) {
      inputRef.current.focus();
      update((mapping) => {
        mapping.isNew = false;
      });
    }
  }, [mapping, inputRef, update]);

  const onChangeColor = (color: string) => {
    update((mapping) => {
      mapping.result.color = color;
    });
  };

  const onClearColor = () => {
    update((mapping) => {
      mapping.result.color = undefined;
    });
  };

  const onChangeIcon = (icon?: string) => {
    update((mapping) => {
      mapping.result.icon = icon;
    });
  };

  const onClearIcon = () => {
    update((mapping) => {
      mapping.result.icon = undefined;
    });
  };

  const onUpdateMatchValue = (event: React.FormEvent<HTMLInputElement>) => {
    update((mapping) => {
      mapping.key = event.currentTarget.value;
    });
  };

  const onChangeText = (event: React.FormEvent<HTMLInputElement>) => {
    update((mapping) => {
      mapping.result.text = event.currentTarget.value;
    });
  };

  const onChangeFrom = (event: React.FormEvent<HTMLInputElement>) => {
    update((mapping) => {
      mapping.from = parseFloat(event.currentTarget.value);
    });
  };

  const onChangeTo = (event: React.FormEvent<HTMLInputElement>) => {
    update((mapping) => {
      mapping.to = parseFloat(event.currentTarget.value);
    });
  };

  const onChangePattern = (event: React.FormEvent<HTMLInputElement>) => {
    update((mapping) => {
      mapping.pattern = event.currentTarget.value;
    });
  };

  const onChangeSpecialMatch = (sel: SelectableValue<SpecialValueMatch>) => {
    update((mapping) => {
      mapping.specialMatch = sel.value;
    });
  };

  const specialMatchOptions: Array<SelectableValue<SpecialValueMatch>> = [
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'Null',
      value: SpecialValueMatch.Null,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.matches-null-and-undefined-values',
        'Matches null and undefined values'
      ),
    },
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'NaN',
      value: SpecialValueMatch.NaN,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.matches-against-number-na-n-not-a-number',
        'Matches against Number.NaN (not a number)'
      ),
    },
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'Null + NaN',
      value: SpecialValueMatch.NullAndNaN,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.matches-null-undefined-and-na-n',
        'Matches null, undefined and NaN'
      ),
    },
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'True',
      value: SpecialValueMatch.True,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.boolean-true-values',
        'Boolean true values'
      ),
    },
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'False',
      value: SpecialValueMatch.False,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.boolean-false-values',
        'Boolean false values'
      ),
    },
    {
      label: t('dimensions.value-mapping-edit-row.special-match-options.label.empty', 'Empty'),
      value: SpecialValueMatch.Empty,
      description: t(
        'dimensions.value-mapping-edit-row.special-match-options.description.empty-string',
        'Empty string'
      ),
    },
  ];

  return (
    <Draggable key={id} draggableId={id} index={index}>
      {(provided) => (
        <tr className={styles.dragRow} ref={provided.innerRef} {...provided.draggableProps}>
          <td>
            <div className={styles.dragHandle} {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </td>
          <td className={styles.typeColumn}>{mapping.type}</td>
          <td>
            {mapping.type === MappingType.ValueToText && (
              <Input
                ref={inputRef}
                type="text"
                value={key ?? ''}
                onChange={onUpdateMatchValue}
                placeholder={t(
                  'dimensions.value-mapping-edit-row.placeholder-exact-value-to-match',
                  'Exact value to match'
                )}
              />
            )}
            {mapping.type === MappingType.RangeToText && (
              <div className={styles.rangeInputWrapper}>
                <Input
                  type="number"
                  value={mapping.from ?? ''}
                  placeholder={t('dimensions.value-mapping-edit-row.placeholder-from', 'From')}
                  onChange={onChangeFrom}
                />
                <Input
                  type="number"
                  value={mapping.to ?? ''}
                  placeholder={t('dimensions.value-mapping-edit-row.placeholder-to', 'To')}
                  onChange={onChangeTo}
                />
              </div>
            )}
            {mapping.type === MappingType.RegexToText && (
              <Input
                type="text"
                value={mapping.pattern ?? ''}
                placeholder={t(
                  'dimensions.value-mapping-edit-row.placeholder-regular-expression',
                  'Regular expression'
                )}
                onChange={onChangePattern}
              />
            )}
            {mapping.type === MappingType.SpecialValue && (
              <Select
                value={specialMatchOptions.find((v) => v.value === mapping.specialMatch)}
                options={specialMatchOptions}
                onChange={onChangeSpecialMatch}
              />
            )}
          </td>
          <td>
            <Input
              type="text"
              value={result.text ?? ''}
              onChange={onChangeText}
              placeholder={t(
                'dimensions.value-mapping-edit-row.placeholder-optional-display-text',
                'Optional display text'
              )}
            />
          </td>
          <td className={styles.textAlignCenter}>
            {result.color && (
              <Stack gap={1} justifyContent="center">
                <ColorPicker color={result.color} onChange={onChangeColor} enableNamedColors={true} />
                <IconButton
                  name="times"
                  onClick={onClearColor}
                  tooltip={t('dimensions.value-mapping-edit-row.tooltip-remove-color', 'Remove color')}
                  tooltipPlacement="top"
                />
              </Stack>
            )}
            {!result.color && (
              <ColorPicker color={'gray'} onChange={onChangeColor} enableNamedColors={true}>
                {(props) => (
                  <Button variant="primary" fill="text" onClick={props.showColorPicker} ref={props.ref} size="sm">
                    <Trans i18nKey="dimensions.value-mapping-edit-row.set-color">Set color</Trans>
                  </Button>
                )}
              </ColorPicker>
            )}
          </td>
          {showIconPicker && (
            <td className={styles.textAlignCenter}>
              <Stack gap={1} justifyContent="center">
                <ResourcePicker
                  onChange={onChangeIcon}
                  onClear={onClearIcon}
                  value={result.icon}
                  size={ResourcePickerSize.SMALL}
                  folderName={ResourceFolderName.Icon}
                  mediaType={MediaType.Icon}
                  color={result.color}
                />
                {result.icon && (
                  <IconButton
                    name="times"
                    onClick={onClearIcon}
                    tooltip={t('dimensions.value-mapping-edit-row.tooltip-remove-icon', 'Remove icon')}
                    tooltipPlacement="top"
                  />
                )}
              </Stack>
            </td>
          )}
          <td className={styles.textAlignCenter}>
            <Stack gap={1}>
              <IconButton
                name="copy"
                onClick={() => onDuplicate(index)}
                data-testid="duplicate-value-mapping"
                aria-label={t(
                  'dimensions.value-mapping-edit-row.duplicate-value-mapping-aria-label-duplicate-value-mapping',
                  'Duplicate value mapping'
                )}
                tooltip={t('dimensions.value-mapping-edit-row.duplicate-value-mapping-tooltip-duplicate', 'Duplicate')}
              />
              <IconButton
                name="trash-alt"
                onClick={() => onRemove(index)}
                data-testid="remove-value-mapping"
                aria-label={t(
                  'dimensions.value-mapping-edit-row.remove-value-mapping-aria-label-delete-value-mapping',
                  'Delete value mapping'
                )}
                tooltip={t('dimensions.value-mapping-edit-row.remove-value-mapping-tooltip-delete', 'Delete')}
              />
            </Stack>
          </td>
        </tr>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dragRow: css({
    position: 'relative',
  }),
  dragHandle: css({
    cursor: 'grab',
    // create focus ring around the whole row when the drag handle is tab-focused
    // needs position: relative on the drag row to work correctly
    '&:focus-visible&:after': {
      bottom: 0,
      content: '""',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  rangeInputWrapper: css({
    display: 'flex',
    '> div:first-child': {
      marginRight: theme.spacing(2),
    },
  }),
  regexInputWrapper: css({
    display: 'flex',
    '> div:first-child': {
      marginRight: theme.spacing(2),
    },
  }),
  typeColumn: css({
    textTransform: 'capitalize',
    textAlign: 'center',
    width: '1%',
  }),
  textAlignCenter: css({
    textAlign: 'center',
  }),
});
