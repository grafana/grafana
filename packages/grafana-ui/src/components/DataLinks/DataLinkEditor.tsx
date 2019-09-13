import React, { useState, ChangeEvent, useContext } from 'react';
import { DataLink } from '@grafana/data';
import { FormField, Switch } from '../index';
import { VariableSuggestion } from './DataLinkSuggestions';
import { css } from 'emotion';
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

    const listItemStyle = css`
      margin-bottom: ${theme.spacing.sm};
    `;

    return (
      <div className={listItemStyle}>
        <div className="gf-form gf-form--inline">
          <FormField
            label="Title"
            value={title}
            onChange={onTitleChange}
            onBlur={onTitleBlur}
            inputWidth={15}
            labelWidth={5}
            placeholder="Show details"
          />
          <Switch label="Open in new tab" checked={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
          <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick} title="Remove link">
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="gf-form">
          <FormField
            label="URL"
            labelWidth={5}
            inputEl={<DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />}
            className={css`
              width: 100%;
            `}
          />
        </div>
      </div>
    );
  }
);

DataLinkEditor.displayName = 'DataLinkEditor';
