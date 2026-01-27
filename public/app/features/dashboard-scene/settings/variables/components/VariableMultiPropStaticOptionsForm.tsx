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
  const [internalOptions, setInternalOptions] = useState<Option[]>(() =>
    options.map((o) => ({ id: uuidv4(), ...o, properties: o.properties ?? {} }))
  );

  // track id of newly added option for auto-focus
  const autoFocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    autoFocusIdRef.current = null;
  });

  const updateOptions = (newOptions: Option[]) => {
    setInternalOptions(newOptions);
    onChange(newOptions.map((o) => ({ label: o.label, value: o.value, properties: o.properties })));
  };

  const onAddNewOption = () => {
    const newId = uuidv4();
    autoFocusIdRef.current = newId;

    const newOption = {
      id: newId,
      label: '',
      value: '',
      properties: properties.reduce((acc, p) => ({ ...acc, [p]: '' }), {}),
    };
    updateOptions([...internalOptions, newOption]);
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
    autoFocusId: autoFocusIdRef.current,
    onAddNewOption,
    onRemoveOption,
    onOptionsReordered,
    onValueChange,
  };
};

export const VariableMultiPropStaticOptionsForm = (props: VariableMultiPropStaticOptionsFormProps) => {
  const styles = useStyles2(getStyles, props.properties.length);
  const { properties, options, autoFocusId, onAddNewOption, onRemoveOption, onOptionsReordered, onValueChange } =
    useVariableMultiPropStaticOptionsForm(props);

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.grid}
        role="grid"
        aria-label={t(
          'dashboard-scene.variable-multi-prop-static-options-form.aria-label-static-options',
          'Static options'
        )}
      >
        <div className={styles.headerRow} role="row">
          <div className={styles.headerCell} role="columnheader" />
          {properties.map((p) => (
            <div key={p} className={styles.headerCell} role="columnheader">
              {p}
            </div>
          ))}
        </div>
        <DragDropContext onDragEnd={onOptionsReordered}>
          <Droppable droppableId="static-options-list" direction="vertical">
            {(droppableProvided) => (
              <div
                className={styles.body}
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                role="rowgroup"
              >
                {options.map((o, i) => (
                  <OptionRow
                    key={o.id}
                    index={i}
                    option={o}
                    properties={properties}
                    autoFocusFirstInput={o.id === autoFocusId}
                    onRemoveOption={onRemoveOption}
                    onValueChange={onValueChange}
                    onAddNewOption={i === options.length - 1 ? onAddNewOption : undefined}
                  />
                ))}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
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
  const styles = useStyles2(getStyles, properties.length);

  const onKeyDown = onAddNewOption
    ? (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          onAddNewOption();
        }
      }
    : undefined;

  return (
    <Draggable draggableId={option.id} index={index}>
      {(draggableProvided) => (
        <div
          className={styles.row}
          ref={draggableProvided.innerRef}
          {...draggableProvided.draggableProps}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.row}
          role="row"
          style={{ ...draggableProvided.draggableProps.style }}
        >
          <div className={styles.cell} role="gridcell">
            <Stack direction="row" alignItems="center" {...draggableProvided.dragHandleProps}>
              <Icon
                title={t('dashboard-scene.option-row.title-drag-and-drop-to-reorder', 'Drag and drop to reorder')}
                name="draggabledots"
                size="lg"
                className={styles.dragIcon}
              />
            </Stack>
          </div>
          {properties.map((p, i) => (
            <div key={`r1-${p}`} className={styles.cell} role="gridcell">
              <Input
                autoFocus={autoFocusFirstInput && !i}
                tabIndex={0}
                placeholder={p}
                value={option.properties[p] ?? ''}
                onChange={(e) => {
                  if (option.properties[p] !== e.currentTarget.value) {
                    onValueChange(option, p, e.currentTarget.value);
                  }
                }}
                onKeyDown={i === properties.length - 1 ? onKeyDown : undefined}
                data-testid={`static-option-input-${p}`}
              />
            </div>
          ))}
          <div className={styles.cell} role="gridcell">
            <IconButton
              name="trash-alt"
              variant="destructive"
              onClick={() => onRemoveOption(option)}
              aria-label={t('dashboard-scene.option-row.aria-label-remove-option', 'Remove option')}
              tooltip={t('dashboard-scene.option-row.tooltip-remove-option', 'Remove option')}
              tooltipPlacement="top"
            />
          </div>
        </div>
      )}
    </Draggable>
  );
}

const getStyles = (theme: GrafanaTheme2, propertiesCount: number) => {
  const gridTemplateColumns = `min-content repeat(${propertiesCount}, 1fr) min-content`;

  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    grid: css({
      display: 'grid',
      gap: theme.spacing(0.5),
      width: '100%',
    }),
    headerRow: css({
      display: 'grid',
      gridTemplateColumns,
      alignItems: 'end',
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerCell: css({
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.primary,
      textAlign: 'left',
      padding: theme.spacing(0, 0.5, 1, 0.5),
    }),
    deletePropertyButton: css({
      position: 'absolute',
      right: '2px',
      zIndex: 1,
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    row: css({
      display: 'grid',
      gridTemplateColumns,
      alignItems: 'center',
      position: 'relative',
    }),
    cell: css({
      padding: theme.spacing(0.5),
    }),
    dragIcon: css({
      cursor: 'grab',
    }),
    addNewOptionButton: css({
      margin: theme.spacing(1, 0, 1, 0),
    }),
  };
};
