import React from 'react';
import { Input } from '../Input/Input';
import { MappingType, ValueMappingResult } from '@grafana/data';
import { Draggable } from 'react-beautiful-dnd';
import { Icon } from '../Icon/Icon';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { LinkButton } from '../Button';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton } from '../IconButton/IconButton';

export interface ValueMappingEditRowModel {
  type: MappingType;
  from?: number;
  to?: number;
  key?: string;
  result: ValueMappingResult;
}

interface Props {
  mapping: ValueMappingEditRowModel;
  index: number;
  onChange: (index: number, mapping: ValueMappingEditRowModel) => void;
}

export function ValueMappingEditRow({ mapping, index, onChange }: Props) {
  const onChangeMatchKey = (value: React.FormEvent<HTMLInputElement>) => {};
  const onChangeValue = (value: React.FormEvent<HTMLInputElement>) => {};
  const onChangeColor = (color: string) => {};
  const onSetColor = () => {};
  const onClearColor = () => {};
  const onRemove = () => {};

  const { key, result } = mapping;

  return (
    <Draggable draggableId={`mapping-${index}`} index={index}>
      {(provided) => (
        <tr ref={provided.innerRef} {...provided.draggableProps}>
          <td>
            <div {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </td>
          <td>
            {mapping.type === MappingType.ValueToText && (
              <Input type="text" value={key ?? ''} onChange={onChangeMatchKey} placeholder="Exact value to match" />
            )}
          </td>
          <td>
            <Input type="text" value={result.value ?? ''} onChange={onChangeValue} placeholder="Number to map to" />
          </td>
          <td>
            <Input type="text" value={result.value ?? ''} onChange={onChangeValue} placeholder="Text state" />
          </td>
          <td>
            {result.color && (
              <HorizontalGroup spacing="sm" justify="center">
                <ColorPicker color={result.color} onChange={onChangeColor} />
                <IconButton name="times" onClick={onClearColor} tooltip="Remove color" tooltipPlacement="top" />
              </HorizontalGroup>
            )}
            {!result.color && (
              <LinkButton variant="primary" fill="text" onClick={onSetColor} size="sm">
                Select a color
              </LinkButton>
            )}
          </td>
          <td>
            <HorizontalGroup spacing="sm">
              <IconButton name="trash-alt" onClick={onRemove} />
            </HorizontalGroup>
          </td>
        </tr>
      )}
    </Draggable>
  );
}
