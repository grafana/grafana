import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';

import { DataFrame, DataLink, GrafanaTheme2, VariableSuggestion } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../../themes';
import { Button } from '../../Button/Button';
import { Modal } from '../../Modal/Modal';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
import { DataLinksListItem } from './DataLinksListItem';

interface DataLinksInlineEditorProps {
  links?: DataLink[];
  onChange: (links: DataLink[]) => void;
  getSuggestions: () => VariableSuggestion[];
  data: DataFrame[];
}

export const DataLinksInlineEditor = ({ links, onChange, getSuggestions, data }: DataLinksInlineEditorProps) => {
  const theme = useTheme2();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);

  const styles = getDataLinksInlineEditorStyles(theme);
  const linksSafe: DataLink[] = links ?? [];
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

  return (
    <>
      {linksSafe.length > 0 && (
        <div className={styles.wrapper}>
          {linksSafe.map((l, i) => {
            return (
              <DataLinksListItem
                key={`${l.title}/${i}`}
                index={i}
                link={l}
                onChange={onDataLinkChange}
                onEdit={() => setEditIndex(i)}
                onRemove={() => onDataLinkRemove(i)}
                data={data}
              />
            );
          })}
        </div>
      )}

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

const getDataLinksInlineEditorStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(2)};
    `,
  };
});
