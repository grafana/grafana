import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { cloneDeep } from 'lodash';
import { useEffect, useState } from 'react';

import { DataFrame, DataLink, GrafanaTheme2, VariableSuggestion } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Trans } from '../../../utils/i18n';
import { Button } from '../../Button';
import { Modal } from '../../Modal/Modal';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
import { DataLinksListItem } from './DataLinksListItem';

interface DataLinksInlineEditorProps {
  links?: DataLink[];
  onChange: (links: DataLink[]) => void;
  getSuggestions: () => VariableSuggestion[];
  data: DataFrame[];
  showOneClick?: boolean;
}

export const DataLinksInlineEditor = ({
  links,
  onChange,
  getSuggestions,
  data,
  showOneClick = false,
}: DataLinksInlineEditorProps) => {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [linksSafe, setLinksSafe] = useState<DataLink[]>([]);

  useEffect(() => {
    setLinksSafe(links ?? []);
  }, [links]);

  const styles = useStyles2(getDataLinksInlineEditorStyles);
  const isEditing = editIndex !== null;

  const onDataLinkChange = (index: number, link: DataLink) => {
    if (isNew) {
      if (link.title.trim() === '' && link.url.trim() === '') {
        setIsNew(false);
        setEditIndex(null);
        return;
      } else {
        setEditIndex(null);
        setIsNew(false);
      }
    }
    const update = cloneDeep(linksSafe);
    update[index] = link;
    onChange(update);
    setEditIndex(null);
  };

  const onDataLinkAdd = () => {
    let update = cloneDeep(linksSafe);
    setEditIndex(update.length);
    setIsNew(true);
  };

  const onDataLinkCancel = (index: number) => {
    if (isNew) {
      setIsNew(false);
    }
    setEditIndex(null);
  };

  const onDataLinkRemove = (index: number) => {
    const update = cloneDeep(linksSafe);
    update.splice(index, 1);
    onChange(update);
  };

  const onDragEnd = (result: DropResult) => {
    if (!links || !result.destination) {
      return;
    }

    const update = cloneDeep(linksSafe);
    const link = update[result.source.index];

    update.splice(result.source.index, 1);
    update.splice(result.destination.index, 0, link);

    setLinksSafe(update);
    onChange(update);
  };

  return (
    <div className={styles.container}>
      {/* one-link placeholder */}
      {showOneClick && linksSafe.length > 0 && (
        <div className={styles.oneClickOverlay}>
          <span className={styles.oneClickSpan}>
            <Trans i18nKey="grafana-ui.data-links-inline-editor.one-click-link">One-click link</Trans>
          </span>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-links" direction="vertical">
          {(provided) => (
            <div
              className={styles.wrapper}
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ paddingTop: showOneClick && linksSafe.length > 0 ? '28px' : '0px' }}
            >
              {linksSafe.map((link, idx) => {
                const key = `${link.title}/${idx}`;
                return (
                  <DataLinksListItem
                    key={key}
                    index={idx}
                    link={link}
                    onChange={onDataLinkChange}
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
          title="Edit link"
          isOpen={true}
          closeOnBackdropClick={false}
          onDismiss={() => {
            onDataLinkCancel(editIndex);
          }}
        >
          <DataLinkEditorModalContent
            index={editIndex}
            link={isNew ? { title: '', url: '' } : linksSafe[editIndex]}
            data={data}
            onSave={onDataLinkChange}
            onCancel={onDataLinkCancel}
            getSuggestions={getSuggestions}
          />
        </Modal>
      )}

      <Button size="sm" icon="plus" onClick={onDataLinkAdd} variant="secondary" className={styles.button}>
        <Trans i18nKey="grafana-ui.data-links-inline-editor.add-link">Add link</Trans>
      </Button>
    </div>
  );
};

const getDataLinksInlineEditorStyles = (theme: GrafanaTheme2) => ({
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
    height: '92px',
  }),
  oneClickSpan: css({
    padding: 10,
    // Negates the padding on the span from moving the underlying link
    marginBottom: -10,
    display: 'inline-block',
  }),
  button: css({
    marginLeft: theme.spacing(1),
  }),
});
