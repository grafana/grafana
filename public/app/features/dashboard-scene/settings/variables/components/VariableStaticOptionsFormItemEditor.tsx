import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { ChangeEventHandler } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Icon, Input, Stack, useStyles2 } from '@grafana/ui';

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
        <Stack
          ref={draggableProvided.innerRef}
          direction="row"
          alignItems="center"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsRow}
          {...draggableProvided.draggableProps}
        >
          <div {...draggableProvided.dragHandleProps}>
            <Icon
              title={t('variables.query-variable-static-options.drag-and-drop', 'Drag and drop to reorder')}
              name="draggabledots"
              size="lg"
              className={styles.dragIcon}
            />
          </div>
          <Input
            value={item.value}
            placeholder={t('variables.query-variable-static-options.value-placeholder', 'Value')}
            onChange={handleValueChange}
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsValueInput
            }
          />
          <Input
            value={item.label}
            placeholder={t('variables.query-variable-static-options.label-placeholder', 'Label, defaults to value')}
            onChange={handleLabelChange}
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsLabelInput
            }
          />
          <Button
            icon="times"
            variant="secondary"
            aria-label={t('variables.query-variable-static-options.remove-option-button-label', 'Remove option')}
            onClick={handleRemove}
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsDeleteButton
            }
          />
        </Stack>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dragIcon: css({
    cursor: 'grab',
    color: theme.colors.text.disabled,

    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});
