import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { cloneDeep } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';

import { DataFrame, DataLink, GrafanaTheme2, VariableSuggestion } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Button } from '../../Button';
import { Modal } from '../../Modal/Modal';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
import { DataLinksListItem } from './DataLinksListItem';

interface DataLinksInlineEditorProps {
  links?: DataLink[];
  onChange: (links: DataLink[]) => void;
  getSuggestions: () => VariableSuggestion[];
  data: DataFrame[];
  oneClickEnabled?: boolean;
}

export const DataLinksInlineEditor = ({
  links,
  onChange,
  getSuggestions,
  data,
  oneClickEnabled = false,
}: DataLinksInlineEditorProps) => {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [linksSafe, setLinksSafe] = useState<DataLink[]>([]);
  links?.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

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

    const copy = [...linksSafe];
    const link = copy[result.source.index];
    link.sortIndex = result.destination.index;

    const swapLink = copy[result.destination.index];
    swapLink.sortIndex = result.source.index;

    copy.splice(result.source.index, 1);
    copy.splice(result.destination.index, 0, link);

    setLinksSafe(copy);
    onChange(linksSafe);
  };

  const renderFirstLink = (linkJSX: ReactNode) => {
    if (oneClickEnabled) {
      return (
        <div className={styles.oneClickOverlay}>
          <span className={styles.oneClickSpan}>One-click</span>
          {linkJSX}
        </div>
      );
    }
    return linkJSX;
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-links" direction="vertical">
          {(provided) => (
            <div className={styles.wrapper} ref={provided.innerRef} {...provided.droppableProps}>
              {linksSafe.map((link, idx) => {
                const key = `${link.title}/${idx}`;

                const linkJSX = (
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

                if (idx === 0) {
                  return renderFirstLink(linkJSX);
                }

                return linkJSX;
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

      <Button size="sm" icon="plus" onClick={onDataLinkAdd} variant="secondary">
        Add link
      </Button>
    </>
  );
};

const getDataLinksInlineEditorStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginBottom: theme.spacing(2),
  }),
  oneClickOverlay: css({
    height: 'auto',
    border: `1px dashed ${theme.colors.border.medium}`,
    paddingBottom: 10,
    fontSize: 10,
    color: theme.colors.text.link,
  }),
  oneClickSpan: css({
    padding: 10,
    // Negates the padding on the span from moving the underlying link
    marginBottom: -10,
    display: 'inline-block',
  }),
});
