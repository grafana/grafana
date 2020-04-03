// Libraries
import React, { FC } from 'react';
// @ts-ignore
import Prism from 'prismjs';
// Components
import { css } from 'emotion';
import { DataLink, VariableSuggestion } from '@grafana/data';
import { Button } from '../index';
import { DataLinkEditor } from './DataLinkEditor';

import { useTheme } from '../../themes/ThemeContext';

interface DataLinksEditorProps {
  value?: DataLink[];
  onChange: (links: DataLink[], callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  maxLinks?: number;
}

export const enableDatalinksPrismSyntax = () => {
  Prism.languages['links'] = {
    builtInVariable: {
      pattern: /(\${\S+?})/,
    },
  };
};

export const DataLinksEditor: FC<DataLinksEditorProps> = React.memo(
  ({ value = [], onChange, suggestions, maxLinks }) => {
    const theme = useTheme();
    enableDatalinksPrismSyntax();

    const onAdd = () => {
      onChange(value ? [...value, { url: '', title: '' }] : [{ url: '', title: '' }]);
    };

    const onLinkChanged = (linkIndex: number, newLink: DataLink, callback?: () => void) => {
      onChange(
        value.map((item, listIndex) => {
          if (linkIndex === listIndex) {
            return newLink;
          }
          return item;
        }),
        callback
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
                isLast={index === value.length - 1}
                value={link}
                onChange={onLinkChanged}
                onRemove={onRemove}
                suggestions={suggestions}
              />
            ))}
          </div>
        )}

        {(!value || (value && value.length < (maxLinks || Infinity))) && (
          <Button variant="secondary" icon="fa fa-plus" onClick={() => onAdd()}>
            Add link
          </Button>
        )}
      </>
    );
  }
);

DataLinksEditor.displayName = 'DataLinksEditor';
