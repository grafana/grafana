import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme2, MappingType, SpecialValueMatch, SelectableValue, ValueMappingResult } from '@grafana/data';
import { useStyles2, Icon, Select, HorizontalGroup, ColorPicker, IconButton, Input, Button } from '@grafana/ui';

import { ResourcePickerSize, ResourceFolderName, MediaType } from '../../types';
import { ResourcePicker } from '../ResourcePicker';

export interface ValueMappingEditRowModel {
  type: MappingType;
  from?: number;
  to?: number;
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
    { label: 'Null', value: SpecialValueMatch.Null, description: 'Matches null and undefined values' },
    { label: 'NaN', value: SpecialValueMatch.NaN, description: 'Matches against Number.NaN (not a number)' },
    { label: 'Null + NaN', value: SpecialValueMatch.NullAndNaN, description: 'Matches null, undefined and NaN' },
    { label: 'True', value: SpecialValueMatch.True, description: 'Boolean true values' },
    { label: 'False', value: SpecialValueMatch.False, description: 'Boolean false values' },
    { label: 'Empty', value: SpecialValueMatch.Empty, description: 'Empty string' },
  ];

  return (
    <Draggable key={id} draggableId={id} index={index}>
      {(provided) => (
        <tr ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <td>
            <div className={styles.dragHandle}>
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
                placeholder="Exact value to match"
              />
            )}
            {mapping.type === MappingType.RangeToText && (
              <div className={styles.rangeInputWrapper}>
                <Input
                  type="number"
                  value={mapping.from ?? ''}
                  placeholder="Range start"
                  onChange={onChangeFrom}
                  prefix="From"
                />
                <Input
                  type="number"
                  value={mapping.to ?? ''}
                  placeholder="Range end"
                  onChange={onChangeTo}
                  prefix="To"
                />
              </div>
            )}
            {mapping.type === MappingType.RegexToText && (
              <Input
                type="text"
                value={mapping.pattern ?? ''}
                placeholder="Regular expression"
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
            <Input type="text" value={result.text ?? ''} onChange={onChangeText} placeholder="Optional display text" />
          </td>
          <td className={styles.textAlignCenter}>
            {result.color && (
              <HorizontalGroup spacing="sm" justify="center">
                <ColorPicker color={result.color} onChange={onChangeColor} enableNamedColors={true} />
                <IconButton name="times" onClick={onClearColor} tooltip="Remove color" tooltipPlacement="top" />
              </HorizontalGroup>
            )}
            {!result.color && (
              <ColorPicker color={'gray'} onChange={onChangeColor} enableNamedColors={true}>
                {(props) => (
                  <Button variant="primary" fill="text" onClick={props.showColorPicker} ref={props.ref} size="sm">
                    Set color
                  </Button>
                )}
              </ColorPicker>
            )}
          </td>
          {showIconPicker && (
            <td className={styles.textAlignCenter}>
              <HorizontalGroup spacing="sm" justify="center">
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
                  <IconButton name="times" onClick={onClearIcon} tooltip="Remove icon" tooltipPlacement="top" />
                )}
              </HorizontalGroup>
            </td>
          )}
          <td className={styles.textAlignCenter}>
            <HorizontalGroup spacing="sm">
              <IconButton name="copy" onClick={() => onDuplicate(index)} data-testid="duplicate-value-mapping" />
              <IconButton name="trash-alt" onClick={() => onRemove(index)} data-testid="remove-value-mapping" />
            </HorizontalGroup>
          </td>
        </tr>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dragHandle: css({
    cursor: 'grab',
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
