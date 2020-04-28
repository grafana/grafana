import { DataFrame, DataLink, GrafanaTheme, VariableSuggestion } from '@grafana/data';
import React, { useState } from 'react';
import { css } from 'emotion';
import { Button } from '../../Button/Button';
import cloneDeep from 'lodash/cloneDeep';
import { Modal } from '../../Modal/Modal';
import { stylesFactory, useTheme } from '../../../themes';
import { DataLinksListItem } from './DataLinksListItem';
import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';

interface DataLinksInlineEditorProps {
  links?: DataLink[];
  onChange: (links: DataLink[]) => void;
  suggestions: VariableSuggestion[];
  data: DataFrame[];
}

export const DataLinksInlineEditor: React.FC<DataLinksInlineEditorProps> = ({ links, onChange, suggestions, data }) => {
  const theme = useTheme();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const styles = getDataLinksInlineEditorStyles(theme);
  const linksSafe: DataLink[] = links ?? [];
  const isEditing = editIndex !== null && linksSafe[editIndex] !== undefined;

  const onDataLinkChange = (index: number, link: DataLink) => {
    const update = cloneDeep(linksSafe);
    update[index] = link;
    onChange(update);
  };

  const onDataLinkAdd = () => {
    let update = cloneDeep(linksSafe);

    update.push({
      title: '',
      url: '',
    });

    setEditIndex(update.length - 1);
    onChange(update);
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
                suggestions={suggestions}
              />
            );
          })}
        </div>
      )}

      {isEditing && editIndex !== null && (
        <Modal
          title="Edit link"
          isOpen={true}
          onDismiss={() => {
            setEditIndex(null);
          }}
        >
          <DataLinkEditorModalContent
            index={editIndex}
            link={linksSafe[editIndex]}
            data={data}
            onChange={onDataLinkChange}
            onClose={() => setEditIndex(null)}
            suggestions={suggestions}
          />
        </Modal>
      )}

      <Button size="sm" icon="plus" onClick={onDataLinkAdd} variant="secondary">
        Add link
      </Button>
    </>
  );
};

const getDataLinksInlineEditorStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.md};
    `,
  };
});
