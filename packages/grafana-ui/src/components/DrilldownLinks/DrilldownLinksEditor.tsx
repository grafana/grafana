// Libraries
import React, { FC, useContext } from 'react';

// Components
import { css } from 'emotion';
import { DrillDownLink, ThemeContext } from '../../index';
import { Button, ButtonVariant } from '../index';
import { DrilldownLinkEditor } from './DrilldownLinkEditor';
import { VariableSuggestion } from './LinksSuggestions';

interface DrilldownLinksEditorProps {
  value: DrillDownLink[];
  onChange: (links: DrillDownLink[]) => void;
  suggestions: VariableSuggestion[];
  maxLinks?: number;
}

export const DrilldownLinksEditor: FC<DrilldownLinksEditorProps> = React.memo(
  ({ value, onChange, suggestions, maxLinks }) => {
    const theme = useContext(ThemeContext);

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
              <DrilldownLinkEditor
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
  }
);

DrilldownLinksEditor.displayName = 'DrilldownLinksEditor';
