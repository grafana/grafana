import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import {
  VariableStaticOptionsFormItem,
  VariableStaticOptionsFormItemEditor,
} from './VariableStaticOptionsFormItemEditor';

interface VariableStaticOptionsFormProps {
  items: VariableStaticOptionsFormItem[];
  onChange: (items: VariableStaticOptionsFormItem[]) => void;
}

export function VariableStaticOptionsFormItems({ items, onChange }: VariableStaticOptionsFormProps) {
  const styles = useStyles2(getStyles);

  const handleReorder = (result: DropResult) => {
    if (!result || !result.destination) {
      return;
    }

    const startIdx = result.source.index;
    const endIdx = result.destination.index;

    if (startIdx === endIdx) {
      return;
    }

    const newItems = [...items];
    const [removedItem] = newItems.splice(startIdx, 1);
    newItems.splice(endIdx, 0, removedItem);
    onChange(newItems);
  };

  const handleChange = (item: VariableStaticOptionsFormItem) => {
    const idx = items.findIndex((currentItem) => currentItem.id === item.id);

    if (idx === -1) {
      return;
    }

    const newOptions = [...items];
    newOptions[idx] = item;
    onChange(newOptions);
  };

  const handleRemove = (item: VariableStaticOptionsFormItem) => {
    const newOptions = items.filter((currentItem) => currentItem.id !== item.id);
    onChange(newOptions);
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.headerIconColumn} />
          <th className={styles.headerInputColumn}>
            <Trans i18nKey="variables.static-options.value-header">Value</Trans>
          </th>
          <th className={styles.headerInputColumn}>
            <Trans i18nKey="variables.static-options.label-header">Display text</Trans>
          </th>
          <th className={styles.headerIconColumn} />
        </tr>
      </thead>
      <DragDropContext onDragEnd={handleReorder}>
        <Droppable droppableId="static-options-list" direction="vertical">
          {(droppableProvided) => (
            <tbody ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
              {items.map((item, idx) => (
                <VariableStaticOptionsFormItemEditor
                  item={item}
                  index={idx}
                  onChange={handleChange}
                  onRemove={handleRemove}
                  key={item.id}
                />
              ))}
              {droppableProvided.placeholder}
            </tbody>
          )}
        </Droppable>
      </DragDropContext>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    'tbody tr': css({
      position: 'relative',
    }),

    'tbody tr:hover': css({
      background: theme.colors.action.hover,
    }),

    'th, td': {
      padding: theme.spacing(1),
      width: '49%',
    },

    'th:first-child, td:first-child, th:last-child, td:last-child': css({
      width: '1%',
    }),
  }),
  headerIconColumn: css({
    width: '1%',
  }),
  headerInputColumn: css({
    width: '49%',
  }),
});
