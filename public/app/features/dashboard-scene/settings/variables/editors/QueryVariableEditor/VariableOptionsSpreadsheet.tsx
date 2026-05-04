import { css } from '@emotion/css';
import {
  DragDropContext,
  Draggable,
  type DraggableProvidedDragHandleProps,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VariableValueOption, type VariableValueOptionProperties } from '@grafana/scenes';
import { Icon, IconButton, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import {
  type StaticOptionsOrderType,
  type StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { useGetPropertiesFromOptions } from '../../components/VariableValuesPreview';

import { SortSelector } from './SortSelector';
import { type ClipboardTextFormat, detectClipboardTextFormat, parseClipboardText, useClipboard } from './clipboard';

type SpreadsheetOption = VariableValueOption & {
  id: string;
  properties: VariableValueOptionProperties;
};

interface VariableOptionsSpreadsheetProps {
  options: VariableValueOption[];
  staticOptions: StaticOptionsType;
  staticOptionsOrder: StaticOptionsOrderType;
  onStaticOptionsChange: (staticOptions: StaticOptionsType) => void;
  onStaticOptionsOrderChange: (staticOptionsOrder: StaticOptionsOrderType) => void;
}

function toSpreadsheetOptions(options: VariableValueOption[]): SpreadsheetOption[] {
  return options.map((o) => ({
    id: uuidv4(),
    ...o,
    properties: { ...o.properties, value: o.value, text: o.label },
  }));
}

function useVariableOptionsSpreadsheet(props: VariableOptionsSpreadsheetProps) {
  const { options, staticOptions, onStaticOptionsChange, staticOptionsOrder, onStaticOptionsOrderChange } = props;
  const properties = useGetPropertiesFromOptions(options, staticOptions);
  const [internalOptions, setInternalOptions] = useState<SpreadsheetOption[]>(() =>
    toSpreadsheetOptions(staticOptions ?? [])
  );

  const emitChange = useCallback(
    (newOptions: SpreadsheetOption[]) => {
      setInternalOptions(newOptions);
      onStaticOptionsChange(newOptions.map((o) => ({ label: o.label, value: o.value, properties: o.properties })));
    },
    [onStaticOptionsChange]
  );

  const createEmptyOption = useCallback(
    (): SpreadsheetOption => ({
      id: uuidv4(),
      label: '',
      value: '',
      properties: properties.reduce<VariableValueOptionProperties>((acc, p) => ({ ...acc, [p]: '' }), {}),
    }),
    [properties]
  );

  const [draftOption, setDraftOption] = useState<SpreadsheetOption>(createEmptyOption);
  const focusDraftRef = useRef(false);

  const handleDraftChange = useCallback((key: string, val: string) => {
    setDraftOption((prev) => {
      const newProperties = { ...prev.properties, [key]: val };
      return {
        ...prev,
        label: newProperties.text ?? prev.label,
        value: newProperties.value ?? prev.value,
        properties: newProperties,
      };
    });
  }, []);

  const handleAdd = useCallback(() => {
    emitChange([...internalOptions, draftOption]);
    setDraftOption(createEmptyOption());
    focusDraftRef.current = true;
  }, [internalOptions, draftOption, emitChange, createEmptyOption]);

  const handleRemove = useCallback(
    (option: SpreadsheetOption) => {
      emitChange(internalOptions.filter((o) => o.id !== option.id));
    },
    [internalOptions, emitChange]
  );

  const handleValueChange = useCallback(
    (option: SpreadsheetOption, key: string, val: string) => {
      emitChange(
        internalOptions.map((o) => {
          if (o.id !== option.id) {
            return o;
          }
          const newProperties = { ...o.properties, [key]: val };
          return {
            ...o,
            label: newProperties.text ?? o.label,
            value: newProperties.value ?? o.value,
            properties: newProperties,
          };
        })
      );
    },
    [internalOptions, emitChange]
  );

  const handleReorder = useCallback(
    (result: DropResult) => {
      if (!result.destination || result.source.index === result.destination.index) {
        return;
      }
      const newOptions = [...internalOptions];
      const [removed] = newOptions.splice(result.source.index, 1);
      newOptions.splice(result.destination.index, 0, removed);
      emitChange(newOptions);
    },
    [internalOptions, emitChange]
  );

  const gridRef = useRef<HTMLTableElement>(null);

  const focusCell = useCallback((row: number, col: number) => {
    const input = gridRef.current?.querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`);
    input?.focus();
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
      const input = e.currentTarget;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusCell(row + 1, col);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusCell(row - 1, col);
          break;
        case 'ArrowRight':
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            focusCell(row, col + 1);
          }
          break;
        case 'ArrowLeft':
          if (input.selectionStart === 0) {
            e.preventDefault();
            focusCell(row, col - 1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          // On the draft row (last row), Enter commits the draft
          if (row === internalOptions.length) {
            handleAdd();
          } else {
            focusCell(row + 1, col);
          }
          break;
      }
    },
    [focusCell, internalOptions.length, handleAdd]
  );

  const handlePaste = useCallback(
    async (text: string) => {
      let parsed: VariableValueOption[];
      try {
        parsed = await parseClipboardText(text, properties);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        alert(`${t('variables.static-options.paste-parse-error', 'Failed to parse pasted data')}: ${message}`);
        return;
      }

      if (!parsed.length) {
        return;
      }

      const emptyProps = properties.reduce<VariableValueOptionProperties>((acc, p) => ({ ...acc, [p]: '' }), {});

      const newOptions: SpreadsheetOption[] = parsed.map((o) => {
        const stringifiedProps: VariableValueOptionProperties = {};
        for (const [key, val] of Object.entries(o.properties ?? {})) {
          stringifiedProps[key] = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
        }
        return {
          id: uuidv4(),
          ...o,
          properties: { ...emptyProps, ...stringifiedProps, value: o.value, text: o.label },
        };
      });

      if (!newOptions.length) {
        return;
      }

      emitChange([...internalOptions, ...newOptions]);
      setDraftOption(createEmptyOption());
    },
    [properties, emitChange, internalOptions, createEmptyOption]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text/plain').trim();
      if (text && detectClipboardTextFormat(text)) {
        e.preventDefault();
        handlePaste(text);
      }
    },
    [handlePaste]
  );

  const shouldFocusDraft = focusDraftRef.current;
  focusDraftRef.current = false;

  return {
    properties,
    rows: internalOptions,
    draftOption,
    shouldFocusDraft,
    gridRef,
    staticOptionsOrder,
    onStaticOptionsOrderChange,
    handleAdd,
    handleRemove,
    handleReorder,
    handleValueChange,
    handleDraftChange,
    handleCellKeyDown,
    handlePaste,
    onPaste,
  };
}

export function VariableOptionsSpreadsheet(props: VariableOptionsSpreadsheetProps) {
  const styles = useStyles2(getStyles);
  const {
    properties,
    rows,
    draftOption,
    staticOptionsOrder,
    onStaticOptionsOrderChange,
    handleAdd,
    handleRemove,
    handleReorder,
    handleValueChange,
    handleDraftChange,
    handleCellKeyDown,
    handlePaste,
    onPaste,
    shouldFocusDraft,
    gridRef,
  } = useVariableOptionsSpreadsheet(props);

  return (
    <Stack direction="column" gap={3}>
      <SortSelector value={staticOptionsOrder} onChange={onStaticOptionsOrderChange} />
      <div>
        <table className={styles.table} ref={gridRef}>
          <thead>
            <tr>
              <th className={styles.headerIconCell} />
              {properties.map((p) => (
                <th key={p} className={styles.headerCell}>
                  {p}
                </th>
              ))}
              <th className={styles.headerIconCell} />
            </tr>
          </thead>
          <DragDropContext onDragEnd={handleReorder}>
            <Droppable
              droppableId="spreadsheet-options"
              direction="vertical"
              renderClone={(provided, _snapshot, rubric) => (
                <table
                  className={styles.table}
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                >
                  <tbody>
                    <tr className={styles.draggingRow}>
                      <SpreadsheetRowCells
                        option={rows[rubric.source.index]}
                        properties={properties}
                        onRemove={() => {}}
                        onValueChange={() => {}}
                      />
                    </tr>
                  </tbody>
                </table>
              )}
            >
              {(droppableProvided) => (
                <tbody ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                  {rows.map((option, index) => (
                    <SpreadsheetRow
                      key={option.id}
                      option={option}
                      index={index}
                      rowIndex={index}
                      properties={properties}
                      onRemove={() => handleRemove(option)}
                      onValueChange={(key, val) => handleValueChange(option, key, val)}
                      onCellKeyDown={handleCellKeyDown}
                    />
                  ))}
                  {droppableProvided.placeholder}
                  <SpreadsheetRow
                    option={draftOption}
                    rowIndex={rows.length}
                    properties={properties}
                    onAdd={handleAdd}
                    onValueChange={(key, val) => handleDraftChange(key, val)}
                    onCellKeyDown={handleCellKeyDown}
                    onFirstInputPaste={onPaste}
                    onClickPaste={handlePaste}
                    autoFocusFirst={shouldFocusDraft}
                  />
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>
      </div>
    </Stack>
  );
}

interface SpreadsheetRowProps extends Omit<SpreadsheetRowCellsProps, 'dragHandleProps'> {
  index?: number;
}

interface SpreadsheetRowCellsProps {
  option: SpreadsheetOption;
  rowIndex?: number;
  properties: string[];
  onRemove?: () => void;
  onAdd?: () => void;
  onValueChange: (key: string, value: string) => void;
  onCellKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => void;
  onFirstInputPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  autoFocusFirst?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onClickPaste?: (text: string) => void;
}

function SpreadsheetRowCells({
  option,
  rowIndex = 0,
  properties,
  onRemove,
  onAdd,
  onValueChange,
  onCellKeyDown,
  onFirstInputPaste,
  autoFocusFirst,
  dragHandleProps,
  onClickPaste,
}: SpreadsheetRowCellsProps) {
  const styles = useStyles2(getStyles);

  const addTooltip = t('variables.static-options.add-option-button-label', 'Add new option');
  const removeTooltip = t('dashboard-scene.option-row.remove-option', 'Remove {{optionName}}', {
    optionName: option.label || option.value,
  });

  return (
    <>
      <td className={styles.actionCell}>
        {onRemove && (
          <Tooltip
            content={t('dashboard-scene.option-row.title-drag-and-drop-to-reorder', 'Drag and drop to reorder')}
            placement="top"
          >
            <div className={styles.dragHandle} {...dragHandleProps}>
              <Icon name="draggabledots" />
            </div>
          </Tooltip>
        )}
        {!onRemove && (
          <div className={styles.actionsGroup}>
            {onClickPaste && <PasteButton onClick={onClickPaste} />}
            {onAdd && (
              <IconButton
                name="plus"
                variant="primary"
                aria-label={addTooltip}
                tooltip={addTooltip}
                tooltipPlacement="top"
                onClick={onAdd}
              />
            )}
          </div>
        )}
      </td>
      {properties.map((p, i) => (
        <td key={p} className={styles.cell}>
          <input
            type="text"
            placeholder={p}
            className={styles.cellInput}
            value={option.properties[p] ?? ''}
            data-row={rowIndex}
            data-col={i}
            onChange={(e) => onValueChange?.(p, e.currentTarget.value)}
            onKeyDown={onCellKeyDown ? (e) => onCellKeyDown(e, rowIndex, i) : undefined}
            onPaste={onFirstInputPaste && i === 0 ? onFirstInputPaste : undefined}
            ref={autoFocusFirst && i === 0 ? (el) => el?.focus() : undefined}
          />
        </td>
      ))}
      <td className={styles.actionCell}>
        {onRemove && (
          <IconButton
            name="trash-alt"
            variant="destructive"
            aria-label={removeTooltip}
            tooltip={removeTooltip}
            tooltipPlacement="top"
            onClick={onRemove}
          />
        )}
      </td>
    </>
  );
}

function SpreadsheetRow(props: SpreadsheetRowProps) {
  const styles = useStyles2(getStyles);
  const { option, index, onRemove } = props;
  const isDraggable = onRemove && index !== undefined;

  if (!isDraggable) {
    return (
      <tr className={styles.row}>
        <SpreadsheetRowCells {...props} />
      </tr>
    );
  }

  return (
    <Draggable draggableId={option.id} index={index}>
      {(draggableProvided) => (
        <tr className={styles.row} ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
          <SpreadsheetRowCells {...props} dragHandleProps={draggableProvided.dragHandleProps} />
        </tr>
      )}
    </Draggable>
  );
}

function getPasteTooltip(format: ClipboardTextFormat): string {
  switch (format) {
    case 'csv':
      return t('dashboard-scene.variable-options-spreadsheet.tooltip-paste-csv', 'Paste CSV data');
    case 'json':
      return t('dashboard-scene.variable-options-spreadsheet.tooltip-paste-json', 'Paste JSON data');
    case 'tsv':
      return t('dashboard-scene.variable-options-spreadsheet.tooltip-paste-spreadsheet', 'Paste spreadsheet data');
    default:
      return t('dashboard-scene.variable-options-spreadsheet.tooltip-nothing-to-paste', 'Nothing to paste');
  }
}

function PasteButton({ onClick }: { onClick: (text: string) => void }) {
  const { text, format } = useClipboard();

  const handleClick = useCallback(() => {
    if (text) {
      onClick(text);
    }
  }, [text, onClick]);

  return (
    <IconButton
      name="clipboard-alt"
      disabled={!format}
      onClick={handleClick}
      aria-label={t(
        'dashboard-scene.variable-options-spreadsheet.aria-label-paste-static-options-from-clipboard',
        'Paste static options from clipboard'
      )}
      tooltip={getPasteTooltip(format)}
      tooltipPlacement="top"
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    table: css({
      borderRadius: theme.shape.radius.default,
      width: '100%',
      borderCollapse: 'collapse',
    }),
    headerCell: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      textAlign: 'left',
      whiteSpace: 'nowrap',
      padding: theme.spacing(0.5, 1),
    }),
    headerIconCell: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      width: theme.spacing(4),
      padding: theme.spacing(0.5),
    }),
    row: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:hover': {
        backgroundColor: rowHoverBg,
      },
      '&:last-child': {
        borderBottom: 0,
      },
    }),
    draggingRow: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: rowHoverBg,
    }),
    cell: css({
      padding: 0,
    }),
    cellInput: css({
      backgroundColor: 'transparent',
      border: '1px solid transparent',
      borderRadius: 'unset',
      padding: theme.spacing(0.5, 1),
      height: 'auto',
      width: '100%',
      lineHeight: theme.typography.body.lineHeight,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      outline: 'none',
      boxSizing: 'border-box',
      '&:hover': {
        border: `1px solid ${theme.colors.border.medium}`,
      },
      '&:focus': {
        border: `1px solid ${theme.colors.primary.border}`,
        boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
      },
    }),
    dragHandle: css({
      cursor: 'grab',
      color: theme.colors.text.secondary,
    }),
    actionCell: css({
      padding: theme.spacing(0.5),
      width: theme.spacing(4),
      textAlign: 'right',
      verticalAlign: 'middle',
      '& > button': {
        display: 'flex',
        margin: '0 auto',
      },
    }),
    actionsGroup: css({
      display: 'flex',
      flexDirection: 'row',
      gap: 0,
      '& > :last-child': css({
        marginRight: 0,
      }),
    }),
  };
};
