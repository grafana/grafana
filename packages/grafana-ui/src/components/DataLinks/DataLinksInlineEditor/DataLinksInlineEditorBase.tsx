import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { cloneDeep } from 'lodash';
import { useEffect, useState } from 'react';

import { Action, DataFrame, DataLink, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { t } from '../../../utils/i18n';
import { Button } from '../../Button';
import { Modal } from '../../Modal/Modal';

import { DataLinksListItemBase } from './DataLinksListItemBase';

export interface DataLinksInlineEditorBaseProps<T extends DataLink | Action> {
  type: 'link' | 'action';
  items?: T[];
  onChange: (items: T[]) => void;
  data: DataFrame[];
  children: (
    item: T,
    index: number,
    onSave: (index: number, item: T) => void,
    onCancel: (index: number) => void
  ) => React.ReactNode;
}

/** @internal */
export function DataLinksInlineEditorBase<T extends DataLink | Action>({
  type,
  items,
  onChange,
  data,
  children,
}: DataLinksInlineEditorBaseProps<T>) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [itemsSafe, setItemsSafe] = useState<T[]>([]);

  useEffect(() => {
    setItemsSafe(items ?? []);
  }, [items]);

  const styles = useStyles2(getDataLinksInlineEditorStyles);
  const isEditing = editIndex !== null;

  const _onChange = (index: number, item: T) => {
    if (isNew) {
      const title = item.title;
      // @ts-ignore - https://github.com/microsoft/TypeScript/issues/27808
      const url = item.url ?? item.fetch?.url ?? '';

      if (title.trim() === '' && url.trim() === '') {
        setIsNew(false);
        setEditIndex(null);
        return;
      } else {
        setEditIndex(null);
        setIsNew(false);
      }
    }

    if (item.oneClick === true) {
      itemsSafe.forEach((item) => {
        if (item.oneClick) {
          item.oneClick = false;
        }
      });
    }

    const update = cloneDeep(itemsSafe);
    update[index] = item;
    onChange(update);
    setEditIndex(null);
  };

  const _onCancel = (index: number) => {
    if (isNew) {
      setIsNew(false);
    }
    setEditIndex(null);
  };

  const onDataLinkAdd = () => {
    let update = cloneDeep(itemsSafe);
    setEditIndex(update.length);
    setIsNew(true);
  };

  const onDataLinkRemove = (index: number) => {
    const update = cloneDeep(itemsSafe);
    update.splice(index, 1);
    onChange(update);
  };

  const onDragEnd = (result: DropResult) => {
    if (items == null || result.destination == null) {
      return;
    }

    const update = cloneDeep(itemsSafe);
    const link = update[result.source.index];

    update.splice(result.source.index, 1);
    update.splice(result.destination.index, 0, link);

    setItemsSafe(update);
    onChange(update);
  };

  const getItemText = (action: 'edit' | 'add') => {
    let text = '';
    switch (type) {
      case 'link':
        text =
          action === 'edit'
            ? t('grafana-ui.data-links-inline-editor.edit-link', 'Edit link')
            : t('grafana-ui.data-links-inline-editor.add-link', 'Add link');
        break;
      case 'action':
        text =
          action === 'edit'
            ? t('grafana-ui.action-editor.inline.edit-action', 'Edit action')
            : t('grafana-ui.action-editor.inline.add-action', 'Add action');
        break;
    }

    return text;
  };

  return (
    <div className={styles.container}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-links" direction="vertical">
          {(provided) => (
            <div className={styles.wrapper} ref={provided.innerRef} {...provided.droppableProps}>
              {itemsSafe.map((item, idx) => {
                const key = `${item.title}/${idx}`;
                return (
                  <DataLinksListItemBase<T>
                    key={key}
                    index={idx}
                    item={item}
                    onChange={_onChange}
                    onEdit={() => setEditIndex(idx)}
                    onRemove={() => onDataLinkRemove(idx)}
                    data={data}
                    itemKey={key}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {isEditing && editIndex !== null && (
        <Modal
          title={getItemText(isNew ? 'add' : 'edit')}
          isOpen={true}
          closeOnBackdropClick={false}
          onDismiss={() => {
            _onCancel(editIndex);
          }}
        >
          {children(itemsSafe[editIndex], editIndex, _onChange, _onCancel)}
        </Modal>
      )}

      <Button size="sm" icon="plus" onClick={onDataLinkAdd} variant="secondary" className={styles.button}>
        {getItemText('add')}
      </Button>
    </div>
  );
}

const getDataLinksInlineEditorStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
  }),
  wrapper: css({
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  }),
  button: css({
    marginLeft: theme.spacing(1),
  }),
});
