import React, { useCallback, useEffect, useRef } from 'react';
import { Input } from '../Input/Input';
import { GrafanaTheme2, MappingType, ValueMappingResult } from '@grafana/data';
import { Draggable } from 'react-beautiful-dnd';
import { Icon } from '../Icon/Icon';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { LinkButton } from '../Button';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton } from '../IconButton/IconButton';
import { useStyles2 } from '../../themes/ThemeContext';
import { css } from '@emotion/css';

export interface ValueMappingEditRowModel {
  type: MappingType;
  from?: number;
  to?: number;
  key?: string;
  isNew?: boolean;
  result: ValueMappingResult;
}

interface Props {
  mapping: ValueMappingEditRowModel;
  index: number;
  onChange: (index: number, mapping: ValueMappingEditRowModel) => void;
  onRemove: (index: number) => void;
}

export function ValueMappingEditRow({ mapping, index, onChange, onRemove }: Props) {
  const { key, result } = mapping;
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

  return (
    <Draggable draggableId={`mapping-${index}`} index={index}>
      {(provided) => (
        <tr ref={provided.innerRef} {...provided.draggableProps}>
          <td>
            <div {...provided.dragHandleProps} className={styles.dragHandle}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </td>
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
                  defaultValue={mapping.from || ''}
                  placeholder="Range start"
                  onBlur={onChangeFrom}
                  prefix="From"
                />
                <Input
                  type="number"
                  defaultValue={mapping.to || ''}
                  placeholder="Range end"
                  onBlur={onChangeTo}
                  prefix="To"
                />
              </div>
            )}
          </td>
          <td>
            <Input type="text" value={result.text ?? ''} onChange={onChangeText} placeholder="Display text" />
          </td>
          <td>
            {result.color && (
              <HorizontalGroup spacing="sm" justify="center">
                <ColorPicker color={result.color} onChange={onChangeColor} enableNamedColors={true} />
                <IconButton name="times" onClick={onClearColor} tooltip="Remove color" tooltipPlacement="top" />
              </HorizontalGroup>
            )}
            {!result.color && (
              <ColorPicker color={'gray'} onChange={onChangeColor} enableNamedColors={true}>
                {(props) => (
                  <LinkButton variant="primary" fill="text" onClick={props.showColorPicker} ref={props.ref} size="sm">
                    Set a color
                  </LinkButton>
                )}
              </ColorPicker>
            )}
          </td>
          <td>
            <HorizontalGroup spacing="sm">
              <IconButton name="trash-alt" onClick={() => onRemove(index)} />
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
});
