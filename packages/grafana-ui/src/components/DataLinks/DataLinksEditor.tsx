// Libraries
import React, { FC, useContext, useEffect } from 'react';
// @ts-ignore
import Prism from 'prismjs';

// Components
import { css } from 'emotion';
import { DrillDownLink, ThemeContext } from '../../index';
import { Button, ButtonVariant } from '../index';
import { DataLinkEditor } from './DataLinkEditor';
import { VariableSuggestion } from './DataLinkSuggestions';

interface DataLinksEditorProps {
  value: DrillDownLink[];
  onChange: (links: DrillDownLink[]) => void;
  suggestions: VariableSuggestion[];
  maxLinks?: number;
}

export const DataLinksEditor: FC<DataLinksEditorProps> = React.memo(({ value, onChange, suggestions, maxLinks }) => {
  const theme = useContext(ThemeContext);

  useEffect(() => {
    // When component did mount, set Prism syntax for links
    Prism.languages['links'] = {
      variable: {
        pattern: /\bvar-[a-zA-Z0-9=\{\}\$,]*/,
      },
      builtInVariable: {
        pattern: /(?<=(&|\?)).*?(?=&|$)/,
      },
    };
  }, []);

  const onAdd = () => {
    onChange([...value, { url: '', title: '' }]);
  };

  const onLinkChanged = (linkIndex: number, newLink: DrillDownLink) => {
    onChange(
      value.map((item, listIndex) => {
        if (linkIndex === listIndex) {
          return newLink;
        }
        return item;
      })
    );
  };

  const onRemove = (link: DrillDownLink) => {
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

      {value.length < (maxLinks || 1) && (
        <Button variant={ButtonVariant.Inverse} icon="fa fa-plus" onClick={() => onAdd()}>
          Create link
        </Button>
      )}
    </>
  );
});

DataLinksEditor.displayName = 'DataLinksEditor';
