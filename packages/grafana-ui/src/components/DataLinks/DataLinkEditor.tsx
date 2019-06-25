import React, { useState, ChangeEvent, useContext } from 'react';
import { DataLink } from '../../index';
import { FormField, Switch } from '../index';
import { VariableSuggestion } from './DataLinkSuggestions';
import { css, cx } from 'emotion';
import { ThemeContext } from '../../themes/index';
import { DataLinkInput } from './DataLinkInput';

interface DataLinkEditorProps {
  index: number;
  value: DataLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DataLink) => void;
  onRemove: (link: DataLink) => void;
}

export const DataLinkEditor: React.FC<DataLinkEditorProps> = React.memo(
  ({ index, value, onChange, onRemove, suggestions }) => {
    const theme = useContext(ThemeContext);
    const [title, setTitle] = useState(value.title);

    const onUrlChange = (url: string) => {
      onChange(index, { ...value, url });
    };
    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    };

    const onTitleBlur = () => {
      onChange(index, { ...value, title: title });
    };

    const onRemoveClick = () => {
      onRemove(value);
    };

    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };

    return (
      <div
        className={cx(
          'gf-form gf-form--inline',
          css`
            > * {
              margin-right: ${theme.spacing.xs};
              &:last-child {
                margin-right: 0;
              }
            }
          `
        )}
      >
        <FormField
          label="Title"
          value={title}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          inputWidth={15}
          labelWidth={5}
        />

        <FormField
          label="URL"
          labelWidth={4}
          inputEl={<DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />}
          className={css`
            width: 100%;
          `}
        />

        <Switch label="Open in new tab" checked={value.targetBlank || false} onChange={onOpenInNewTabChanged} />

        <div className="gf-form">
          <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick}>
            <i className="fa fa-times" />
          </button>
        </div>
      </div>
    );
  }
);

DataLinkEditor.displayName = 'DataLinkEditor';
