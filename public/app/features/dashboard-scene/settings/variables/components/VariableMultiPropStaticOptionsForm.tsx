import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { VariableValueOption, VariableValueOptionProperties } from '@grafana/scenes';
import { Icon, IconButton, Input, Stack, useStyles2 } from '@grafana/ui';

import { VariableStaticOptionsFormAddButton } from './VariableStaticOptionsFormAddButton';

type Option = VariableValueOption & {
  id: string;
  properties: VariableValueOptionProperties;
};

type VariableMultiPropStaticOptionsFormProps = {
  options: VariableValueOption[];
  properties: string[];
  onChange: (options: VariableValueOption[]) => void;
  allowEmptyValue?: boolean;
  isInModal?: boolean;
};

const useVariableMultiPropStaticOptionsForm = ({
  options,
  properties,
  onChange,
}: VariableMultiPropStaticOptionsFormProps) => {
  const [internalOptions, setInternalOptions] = useState<Option[]>([]);
  useEffect(() => {
    setInternalOptions(options.map((o) => ({ id: uuidv4(), ...o, properties: o.properties ?? {} })));
  }, [options]);

  const focusNextRef = useRef(false);
  // If new options are added/removed, clear the focus flag (no extra re-render)
  useEffect(() => {
    if (focusNextRef.current) {
      focusNextRef.current = false;
    }
  }, [internalOptions.length]);

  const updateOptions = (newOptions: Option[]) => {
    setInternalOptions(newOptions);
    onChange(newOptions.map((o) => ({ label: o.label, value: o.value, properties: o.properties })));
  };

  const onAddNewOption = () => {
    // Mark that the next appended row should focus its first input
    focusNextRef.current = true;

    const newOption = {
      id: uuidv4(),
      label: '',
      value: '',
      properties: properties.reduce((acc, p) => ({ ...acc, [p]: '' }), {}),
    };
    const newOptions = [...internalOptions, newOption];
    updateOptions(newOptions);
  };

  const onRemoveOption = (o: Option) => {
    const newOptions = internalOptions.filter(({ id }) => o.id !== id);
    updateOptions(newOptions);
  };

  const onOptionsReordered = (result: DropResult) => {
    if (!result || !result.destination) {
      return;
    }

    const startIdx = result.source.index;
    const endIdx = result.destination.index;
    if (startIdx === endIdx) {
      return;
    }

    const newOptions = [...internalOptions];
    const [removedItem] = newOptions.splice(startIdx, 1);
    newOptions.splice(endIdx, 0, removedItem);
    updateOptions(newOptions);
  };

  const onValueChange = (o: Option, key: string, value: string) => {
    const newOptions = internalOptions.map((option) => {
      if (option.id === o.id) {
        const newProperties = { ...option.properties, [key]: value };
        return {
          ...option,
          label: newProperties.text,
          value: newProperties.value,
          properties: newProperties,
        };
      } else {
        return option;
      }
    });
    updateOptions(newOptions);
  };

  return {
    properties,
    options: internalOptions,
    focusNextRef,
    onAddNewOption,
    onRemoveOption,
    onOptionsReordered,
    onValueChange,
  };
};

export const VariableMultiPropStaticOptionsForm = (props: VariableMultiPropStaticOptionsFormProps) => {
  const styles = useStyles2(getStyles);
  const { properties, options, focusNextRef, onAddNewOption, onRemoveOption, onOptionsReordered, onValueChange } =
    useVariableMultiPropStaticOptionsForm(props);

  return (
    <div className={styles.wrapper}>
      <table
        className={styles.table}
        role="grid"
        aria-label={t(
          'dashboard-scene.variable-multi-prop-static-options-form.aria-label-object-values',
          'Object values'
        )}
      >
        <thead className={styles.thead}>
          <tr>
            <th className={styles.headerCell} />
            {properties.map((p) => (
              <th key={p} className={styles.headerCell}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <DragDropContext onDragEnd={onOptionsReordered}>
          <Droppable droppableId="static-options-list" direction="vertical">
            {(droppableProvided) => (
              <tbody className={styles.body} ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                {options.map((o, i) => (
                  <OptionRow
                    key={o.id}
                    index={i}
                    option={o}
                    properties={properties}
                    autoFocusFirstInput={i === options.length - 1 && focusNextRef.current}
                    onRemoveOption={onRemoveOption}
                    onValueChange={onValueChange}
                    onAddNewOption={i === options.length - 1 ? onAddNewOption : undefined}
                  />
                ))}
                {droppableProvided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
      <div className={styles.addNewOptionButton}>
        <VariableStaticOptionsFormAddButton onAdd={onAddNewOption} />
      </div>
    </div>
  );
};

type OptionRowProps = {
  index: number;
  option: Option;
  properties: string[];
  autoFocusFirstInput?: boolean;
  onRemoveOption: (option: Option) => void;
  onValueChange: (option: Option, key: string, value: string) => void;
  onAddNewOption?: () => void;
};

function OptionRow({
  index,
  option,
  properties,
  autoFocusFirstInput,
  onAddNewOption,
  onRemoveOption,
  onValueChange,
}: OptionRowProps) {
  const styles = useStyles2(getStyles);

  const onAddNewOptionAfterEnter = onAddNewOption
    ? (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          onAddNewOption();
        }
      }
    : undefined;

  return (
    <Draggable draggableId={option.id} index={index}>
      {(draggableProvided) => (
        <tr className={styles.row} ref={draggableProvided.innerRef} {...draggableProvided.draggableProps} data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.row}>
          <td>
            <Stack direction="row" alignItems="center" {...draggableProvided.dragHandleProps}>
              <Icon
                title={t('dashboard-scene.option-row.title-drag-and-drop-to-reorder', 'Drag and drop to reorder')}
                name="draggabledots"
                size="lg"
                className={styles.dragIcon}
              />
            </Stack>
          </td>
          {properties.map((p, i) => (
            <td key={`r1-${p}`} className={styles.cell}>
              <Input
                placeholder={p}
                defaultValue={option.properties[p]}
                onBlur={(e) => onValueChange(option, p, e.currentTarget.value)}
                onKeyDown={i === properties.length - 1 ? onAddNewOptionAfterEnter : undefined}
                autoFocus={autoFocusFirstInput && !i}
                data-testid={`static-option-input-${p}`}
              />
            </td>
          ))}
          <td className={styles.cell}>
            <IconButton
              name="trash-alt"
              variant="destructive"
              onClick={() => onRemoveOption(option)}
              aria-label={t('dashboard-scene.option-row.aria-label-remove-option', 'Remove option')}
              tooltip={t('dashboard-scene.option-row.tooltip-remove-option', 'Remove option')}
              tooltipPlacement="top"
            />
          </td>
        </tr>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  table: css({
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: `0 ${theme.spacing(0.5)}`,
  }),
  thead: css({}),
  headerCell: css({
    position: 'sticky',
    top: 0,
    background: theme.colors.background.primary,
    zIndex: 2,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
    textAlign: 'left',
    padding: theme.spacing(0, 0.5, 1, 0.5),
    verticalAlign: 'bottom',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  deletePropertyButton: css({
    position: 'absolute',
    right: '2px',
    zIndex: 1,
  }),
  body: css({}),
  row: css({}),
  cell: css({
    padding: theme.spacing(0.5),
    verticalAlign: 'bottom',
  }),
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
  addNewOptionButton: css({
    margin: theme.spacing(1, 0, 1, 0),
  }),
});
