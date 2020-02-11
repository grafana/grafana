import {
  FieldOverrideContext,
  FieldConfigEditorProps,
  DataLink,
  FieldOverrideEditorProps,
  DataFrame,
} from '@grafana/data';
import React, { FC, useState } from 'react';
import { css, cx } from 'emotion';
import Forms from '../Forms';
import { Modal } from '../Modal/Modal';
import { DataLinkEditor } from '../DataLinks/DataLinkEditor';
import cloneDeep from 'lodash/cloneDeep';
import { VariableSuggestion } from '@grafana/data';

export interface DataLinksFieldConfigSettings {}

export const dataLinksOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  _settings: DataLinksFieldConfigSettings
) => {
  return value as DataLink[];
};

export const DataLinksValueEditor: React.FC<FieldConfigEditorProps<DataLink[], DataLinksFieldConfigSettings>> = ({
  value,
  onChange,
  context,
}) => {
  const onDataLinkChange = (index: number, link: DataLink) => {
    const links = cloneDeep(value);
    links[index] = link;
    onChange(links);
  };

  const onDataLinkAdd = () => {
    const links = cloneDeep(value);

    links.push({
      title: '',
      url: '',
    });
    onChange(links);
  };

  return (
    <>
      {value &&
        value.map((l, i) => {
          return (
            <DataLinksListItem
              key={`${l.title}/${i}`}
              index={i}
              link={l}
              onChange={onDataLinkChange}
              data={context.data}
              suggestions={context.getSuggestions ? context.getSuggestions() : []}
            />
          );
        })}

      <Forms.Button size="sm" icon="fa fa-plus" onClick={onDataLinkAdd}>
        Create data link
      </Forms.Button>
    </>
  );
};

export const DataLinksOverrideEditor: React.FC<FieldOverrideEditorProps<DataLink[], DataLinksFieldConfigSettings>> = ({
  value,
  onChange,
  context,
  item,
}) => {
  const onDataLinkChange = (index: number, link: DataLink) => {
    const links = cloneDeep(value);
    links[index] = link;
    onChange(links);
  };

  const onDataLinkAdd = () => {
    let links = cloneDeep(value);
    if (links) {
      links.push({
        title: '',
        url: '',
      });
    } else {
      links = [
        {
          title: '',
          url: '',
        },
      ];
    }
    onChange(links);
  };

  return (
    <>
      {value &&
        value.map((l, i) => {
          return (
            <DataLinksListItem
              key={`${l.title}/${i}`}
              index={i}
              link={l}
              onChange={onDataLinkChange}
              data={context.data}
              suggestions={context.getSuggestions ? context.getSuggestions() : []}
            />
          );
        })}

      <Forms.Button size="sm" icon="fa fa-plus" onClick={onDataLinkAdd}>
        Create data link
      </Forms.Button>
    </>
  );
};

interface DataLinksListItemProps {
  index: number;
  link: DataLink;
  data: DataFrame[];
  onChange: (index: number, link: DataLink) => void;
  suggestions: VariableSuggestion[];
}

const DataLinksListItem: FC<DataLinksListItemProps> = ({ index, link, data, onChange, suggestions }) => {
  const [isEditing, setIsEditing] = useState(false);

  const style = () => {
    return {
      wrapper: css`
        display: flex;
        justify-content: space-between;
      `,
      action: css`
        flex-shrink: 0;
        flex-grow: 0;
      `,
      noTitle: css`
        font-style: italic;
      `,
    };
  };

  const styles = style();
  const hasTitle = link.title.trim() !== '';

  return (
    <>
      <div className={styles.wrapper}>
        <div className={cx(!hasTitle && styles.noTitle)}>{hasTitle ? link.title : 'Edit data link'}</div>
        <div>
          <Forms.Button size="sm" icon="fa fa-pencil" variant="link" onClick={() => setIsEditing(true)} />
        </div>
      </div>

      {isEditing && (
        <Modal
          title="Edit data link"
          isOpen={isEditing}
          onDismiss={() => {
            setIsEditing(false);
          }}
        >
          <DataLinkEditorModalContent
            index={index}
            link={link}
            data={data}
            onChange={onChange}
            onClose={() => setIsEditing(false)}
            suggestions={suggestions}
          />
        </Modal>
      )}
    </>
  );
};

interface DataLinkEditorModalContentProps {
  link: DataLink;
  index: number;
  data: DataFrame[];
  suggestions: VariableSuggestion[];
  onChange: (index: number, ink: DataLink) => void;
  onClose: () => void;
}

const DataLinkEditorModalContent: FC<DataLinkEditorModalContentProps> = ({
  link,
  index,
  data,
  suggestions,
  onChange,
  onClose,
}) => {
  const [dirtyLink, setDirtyLink] = useState(link);

  return (
    <>
      <DataLinkEditor
        value={dirtyLink}
        index={index}
        isLast={false}
        suggestions={suggestions}
        onChange={(index, link) => {
          setDirtyLink(link);
        }}
        onRemove={() => {}}
      />
      <Forms.Button
        onClick={() => {
          onChange(index, dirtyLink);
          onClose();
        }}
      >
        Save
      </Forms.Button>
      <Forms.Button onClick={() => onClose()}>Cancel</Forms.Button>
    </>
  );
};
