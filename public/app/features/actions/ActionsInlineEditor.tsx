import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { cloneDeep } from 'lodash';
import { useEffect, useState } from 'react';

import { Action, DataFrame, GrafanaTheme2, defaultActionConfig, VariableSuggestion } from '@grafana/data';
import { Button } from '@grafana/ui/src/components/Button';
import { Modal } from '@grafana/ui/src/components/Modal/Modal';
import { useStyles2 } from '@grafana/ui/src/themes';
import { Trans } from 'app/core/internationalization';

import { ActionEditorModalContent } from './ActionEditorModalContent';
import { ActionListItem } from './ActionsListItem';

interface ActionsInlineEditorProps {
  actions?: Action[];
  onChange: (actions: Action[]) => void;
  data: DataFrame[];
  getSuggestions: () => VariableSuggestion[];
  showOneClick?: boolean;
}

export const ActionsInlineEditor = ({
  actions,
  onChange,
  data,
  getSuggestions,
  showOneClick = false,
}: ActionsInlineEditorProps) => {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [actionsSafe, setActionsSafe] = useState<Action[]>([]);

  useEffect(() => {
    setActionsSafe(actions ?? []);
  }, [actions]);

  const styles = useStyles2(getActionsInlineEditorStyle);
  const isEditing = editIndex !== null;

  const onActionChange = (index: number, action: Action) => {
    if (isNew) {
      if (action.title.trim() === '') {
        setIsNew(false);
        setEditIndex(null);
        return;
      } else {
        setEditIndex(null);
        setIsNew(false);
      }
    }
    const update = cloneDeep(actionsSafe);
    update[index] = action;
    onChange(update);

    setEditIndex(null);
  };

  const onActionAdd = () => {
    let update = cloneDeep(actionsSafe);
    setEditIndex(update.length);
    setIsNew(true);
  };

  const onActionCancel = (index: number) => {
    if (isNew) {
      setIsNew(false);
    }
    setEditIndex(null);
  };

  const onActionRemove = (index: number) => {
    const update = cloneDeep(actionsSafe);
    update.splice(index, 1);
    onChange(update);
  };

  const onDragEnd = (result: DropResult) => {
    if (!actions || !result.destination) {
      return;
    }

    const update = cloneDeep(actionsSafe);
    const action = update[result.source.index];

    update.splice(result.source.index, 1);
    update.splice(result.destination.index, 0, action);

    setActionsSafe(update);
    onChange(update);
  };

  return (
    <div className={styles.container}>
      {/* one-link placeholder */}
      {showOneClick && actionsSafe.length > 0 && (
        <div className={styles.oneClickOverlay}>
          <span className={styles.oneClickSpan}>
            <Trans i18nKey="actions-editor.inline.one-click-link">One-click link</Trans>
          </span>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-actions" direction="vertical">
          {(provided) => (
            <div
              className={styles.wrapper}
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ paddingTop: showOneClick && actionsSafe.length > 0 ? '28px' : '0px' }}
            >
              {actionsSafe.map((action, idx) => {
                const key = `${action.title}/${idx}`;

                return (
                  <ActionListItem
                    key={key}
                    index={idx}
                    action={action}
                    onChange={onActionChange}
                    onEdit={() => setEditIndex(idx)}
                    onRemove={() => onActionRemove(idx)}
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
          title="Edit action"
          isOpen={true}
          closeOnBackdropClick={false}
          onDismiss={() => {
            onActionCancel(editIndex);
          }}
        >
          <ActionEditorModalContent
            index={editIndex}
            action={isNew ? defaultActionConfig : actionsSafe[editIndex]}
            data={data}
            onSave={onActionChange}
            onCancel={onActionCancel}
            getSuggestions={getSuggestions}
          />
        </Modal>
      )}

      <Button size="sm" icon="plus" onClick={onActionAdd} variant="secondary" className={styles.button}>
        <Trans i18nKey="actions-editor.inline.add-button">Add action</Trans>
      </Button>
    </div>
  );
};

const getActionsInlineEditorStyle = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
  }),
  wrapper: css({
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  }),
  oneClickOverlay: css({
    border: `2px dashed ${theme.colors.text.link}`,
    fontSize: 10,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing(1),
    position: 'absolute',
    width: '100%',
    height: '89px',
  }),
  oneClickSpan: css({
    padding: 10,
    // Negates the padding on the span from moving the underlying link
    marginBottom: -10,
    display: 'inline-block',
  }),
  itemWrapper: css({
    padding: '4px 8px 8px 8px',
  }),
  button: css({
    marginLeft: theme.spacing(1),
  }),
});
