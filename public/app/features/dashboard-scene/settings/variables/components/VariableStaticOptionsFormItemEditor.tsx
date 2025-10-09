import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { ChangeEventHandler } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Input, Stack, useStyles2 } from '@grafana/ui';

export interface VariableStaticOptionsFormItem {
  id: string;
  label: string;
  value: string;
}

interface VariableStaticOptionsFormItemEditorProps {
  item: VariableStaticOptionsFormItem;
  index: number;
  onChange: (item: VariableStaticOptionsFormItem) => void;
  onRemove: (item: VariableStaticOptionsFormItem) => void;
}

export function VariableStaticOptionsFormItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: VariableStaticOptionsFormItemEditorProps) {
  const styles = useStyles2(getStyles);

  const handleValueChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    if (item.value !== evt.currentTarget.value) {
      onChange({ ...item, value: evt.currentTarget.value });
    }
  };

  const handleLabelChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    if (item.label !== evt.currentTarget.value) {
      onChange({ ...item, label: evt.currentTarget.value });
    }
  };

  const handleRemove = () => onRemove(item);

  return (
    <Draggable draggableId={item.id} index={index}>
      {(draggableProvided) => (
        <tr
          ref={draggableProvided.innerRef}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.row}
          {...draggableProvided.draggableProps}
        >
          <td>
            <Stack
              direction="row"
              alignItems="center"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.moveButton}
              {...draggableProvided.dragHandleProps}
            >
              <Icon
                title={t('variables.static-options.drag-and-drop', 'Drag and drop to reorder')}
                name="draggabledots"
                size="lg"
                className={styles.dragIcon}
              />
            </Stack>
          </td>
          <td>
            <Input
              value={item.value}
              placeholder={t('variables.static-options.value-placeholder', 'Value')}
              onChange={handleValueChange}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.valueInput}
            />
          </td>
          <td>
            <Input
              value={item.label}
              placeholder={t('variables.static-options.label-placeholder', 'Defaults to value')}
              onChange={handleLabelChange}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.labelInput}
            />
          </td>
          <td>
            <Stack direction="row" alignItems="center">
              <IconButton
                name="trash-alt"
                aria-label={t('variables.static-options.remove-option-button-label', 'Remove option')}
                onClick={handleRemove}
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.deleteButton}
              />
            </Stack>
          </td>
        </tr>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dragIcon: css({
    cursor: 'grab',

    // create a focus ring around the whole row when the drag handle is tab-focused
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
});
