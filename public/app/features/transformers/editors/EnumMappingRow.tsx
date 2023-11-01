import { css } from '@emotion/css';
import React, { FormEvent, useState, KeyboardEvent } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, IconButton, HorizontalGroup, FieldValidationMessage, useStyles2 } from '@grafana/ui';

type EnumMappingRowProps = {
  convertFieldTransformIndex: number;
  value: string;
  index: number;
  mappedIndex: number;
  onChangeEnumValue: (index: number, value: string) => void;
  onRemoveEnumRow: (index: number) => void;
  checkIsEnumUniqueValue: (value: string) => boolean;
};

const EnumMappingRow = ({
  convertFieldTransformIndex,
  value,
  index,
  mappedIndex,
  onChangeEnumValue,
  onRemoveEnumRow,
  checkIsEnumUniqueValue,
}: EnumMappingRowProps) => {
  const styles = useStyles2(getStyles);

  const [enumValue, setEnumValue] = useState<string>(value);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEnumInputChange = (event: FormEvent<HTMLInputElement>) => {
    if (
      event.currentTarget.value !== '' &&
      checkIsEnumUniqueValue(event.currentTarget.value) &&
      event.currentTarget.value !== value
    ) {
      setValidationError('Enum value already exists');
    } else {
      setValidationError(null);
    }

    setEnumValue(event.currentTarget.value);
  };

  const onEnumInputBlur = () => {
    setIsEditing(false);
    setValidationError(null);
    onChangeEnumValue(mappedIndex, enumValue);
  };

  const onEnumInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onEnumInputBlur();
    }
  };

  const onEnumValueClick = () => {
    setIsEditing(true);
  };

  const onRemoveButtonClick = () => {
    onRemoveEnumRow(mappedIndex);
  };

  return (
    <Draggable
      key={`${convertFieldTransformIndex}/${value}`}
      draggableId={`${convertFieldTransformIndex}/${value}`}
      index={index}
    >
      {(provided) => (
        <tr key={index} ref={provided.innerRef} {...provided.draggableProps}>
          <td>
            <div className={styles.dragHandle} {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </td>
          {isEditing ? (
            <td>
              <Input
                type="text"
                value={enumValue}
                onChange={onEnumInputChange}
                onBlur={onEnumInputBlur}
                onKeyDown={onEnumInputKeyDown}
              />
              {validationError && <FieldValidationMessage>{validationError}</FieldValidationMessage>}
            </td>
          ) : (
            <td onClick={onEnumValueClick} className={styles.clickableTableCell}>
              {value && value !== '' ? value : 'Click to edit'}
            </td>
          )}
          <td className={styles.textAlignCenter}>
            <HorizontalGroup spacing="sm">
              <IconButton
                name="trash-alt"
                onClick={onRemoveButtonClick}
                data-testid="remove-enum-row"
                aria-label="Delete enum row"
                tooltip="Delete"
              />
            </HorizontalGroup>
          </td>
        </tr>
      )}
    </Draggable>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
  textAlignCenter: css({
    textAlign: 'center',
  }),
  clickableTableCell: css({
    cursor: 'pointer',
  }),
});

export default EnumMappingRow;
