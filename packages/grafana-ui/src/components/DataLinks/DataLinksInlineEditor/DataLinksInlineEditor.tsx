import { DataFrame, DataLink, GrafanaTheme, VariableSuggestion } from '@grafana/data';
import React, { useState } from 'react';
import { css } from 'emotion';
import Forms from '../../Forms';
import cloneDeep from 'lodash/cloneDeep';
import { Modal } from '../../Modal/Modal';
import { FullWidthButtonContainer } from '../../Button/FullWidthButtonContainer';
import { selectThemeVariant, stylesFactory, useTheme } from '../../../themes';
import { DataLinksListItem } from './DataLinksListItem';
import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';

interface DataLinksInlineEditorProps {
  links: DataLink[];
  onChange: (links: DataLink[]) => void;
  suggestions: VariableSuggestion[];
  data: DataFrame[];
}

export const DataLinksInlineEditor: React.FC<DataLinksInlineEditorProps> = ({ links, onChange, suggestions, data }) => {
  const theme = useTheme();
  const [editIndex, setEditIndex] = useState();
  const isEditing = editIndex !== null && editIndex !== undefined;
  const styles = getDataLinksInlineEditorStyles(theme);

  const onDataLinkChange = (index: number, link: DataLink) => {
    const update = cloneDeep(links);
    update[index] = link;
    onChange(update);
  };

  const onDataLinkAdd = () => {
    let update = cloneDeep(links);
    if (update) {
      update.push({
        title: '',
        url: '',
      });
    } else {
      update = [
        {
          title: '',
          url: '',
        },
      ];
    }
    setEditIndex(update.length - 1);
    onChange(update);
  };

  const onDataLinkRemove = (index: number) => {
    const update = cloneDeep(links);
    update.splice(index, 1);
    onChange(update);
  };

  return (
    <>
      {links && (
        <div className={styles.wrapper}>
          {links.map((l, i) => {
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

      {isEditing && (
        <Modal
          title="Edit data link"
          isOpen={isEditing}
          onDismiss={() => {
            setEditIndex(null);
          }}
        >
          <DataLinkEditorModalContent
            index={editIndex}
            link={links[editIndex]}
            data={data}
            onChange={onDataLinkChange}
            onClose={() => setEditIndex(null)}
            suggestions={suggestions}
          />
        </Modal>
      )}

      <FullWidthButtonContainer>
        <Forms.Button size="sm" icon="fa fa-plus" onClick={onDataLinkAdd}>
          Add data link
        </Forms.Button>
      </FullWidthButtonContainer>
    </>
  );
};

const getDataLinksInlineEditorStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.dark9,
    },
    theme.type
  );

  const shadow = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.black,
    },
    theme.type
  );

  return {
    wrapper: css`
      border: 1px dashed ${borderColor};
      margin-bottom: ${theme.spacing.md};
      transition: box-shadow 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      box-shadow: none;

      &:hover {
        box-shadow: 0 0 10px ${shadow};
      }
    `,
  };
});
