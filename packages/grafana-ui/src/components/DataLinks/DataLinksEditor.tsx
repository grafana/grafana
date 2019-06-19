// Libraries
import React, { FC, useContext } from 'react';
// @ts-ignore
import Prism from 'prismjs';
// Components
import { css } from 'emotion';
import { DataLink, ThemeContext } from '../../index';
import { Button } from '../index';
import { DataLinkEditor } from './DataLinkEditor';
import { VariableSuggestion } from './DataLinkSuggestions';

interface DataLinksEditorProps {
  value: DataLink[];
  onChange: (links: DataLink[]) => void;
  suggestions: VariableSuggestion[];
  maxLinks?: number;
}

Prism.languages['links'] = {
  builtInVariable: {
    pattern: /(\${\w+})/,
  },
};

export const DataLinksEditor: FC<DataLinksEditorProps> = React.memo(({ value, onChange, suggestions, maxLinks }) => {
  const theme = useContext(ThemeContext);

  const onAdd = () => {
    onChange(value ? [...value, { url: '', title: '' }] : [{ url: '', title: '' }]);
  };

  const onLinkChanged = (linkIndex: number, newLink: DataLink) => {
    onChange(
      value.map((item, listIndex) => {
        if (linkIndex === listIndex) {
          return newLink;
        }
        return item;
      })
    );
  };

  const onRemove = (link: DataLink) => {
    onChange(value.filter(item => item !== link));
  };

  return (
    <>
      {value && value.length > 0 && (
        <div
          className={css`
            margin-bottom: ${theme.spacing.sm};
          `}
        >
          {value.map((link, index) => (
            <DataLinkEditor
              key={index.toString()}
              index={index}
              value={link}
              onChange={onLinkChanged}
              onRemove={onRemove}
              suggestions={suggestions}
            />
          ))}
        </div>
      )}

      {(!value || (value && value.length < (maxLinks || 1))) && (
        <Button variant="inverse" icon="fa fa-plus" onClick={() => onAdd()}>
          Create link
        </Button>
      )}
    </>
  );
});

DataLinksEditor.displayName = 'DataLinksEditor';
