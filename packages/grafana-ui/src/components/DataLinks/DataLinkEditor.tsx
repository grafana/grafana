import React, { ChangeEvent, useContext } from 'react';
import { DataLink, VariableSuggestion, GrafanaTheme } from '@grafana/data';
import { FormField, Switch } from '../index';
import { css } from 'emotion';
import { ThemeContext, stylesFactory } from '../../themes/index';
import { DataLinkInput } from './DataLinkInput';

interface DataLinkEditorProps {
  index: number;
  isLast: boolean;
  value: DataLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DataLink, callback?: () => void) => void;
  onRemove: (link: DataLink) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  listItem: css`
    margin-bottom: ${theme.spacing.sm};
  `,
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    margin-left: 66px;
    color: ${theme.colors.textWeak};
  `,
}));

export const DataLinkEditor: React.FC<DataLinkEditorProps> = React.memo(
  ({ index, value, onChange, onRemove, suggestions, isLast }) => {
    const theme = useContext(ThemeContext);
    const styles = getStyles(theme);

    const onUrlChange = (url: string, callback?: () => void) => {
      onChange(index, { ...value, url }, callback);
    };
    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, title: event.target.value });
    };

    const onRemoveClick = () => {
      onRemove(value);
    };

    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };

    return (
      <div className={styles.listItem}>
        <div className="gf-form gf-form--inline">
          <FormField
            className="gf-form--grow"
            label="Title"
            value={value.title}
            onChange={onTitleChange}
            inputWidth={0}
            labelWidth={5}
            placeholder="Show details"
          />
          <Switch label="Open in new tab" checked={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
          <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick} title="Remove link">
            <i className="fa fa-times" />
          </button>
        </div>
        <FormField
          label="URL"
          labelWidth={5}
          inputEl={<DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />}
          className={css`
            width: 100%;
          `}
        />
        {isLast && (
          <div className={styles.infoText}>
            With data links you can reference data variables like series name, labels and values. Type CMD+Space,
            CTRL+Space, or $ to open variable suggestions.
          </div>
        )}
      </div>
    );
  }
);

DataLinkEditor.displayName = 'DataLinkEditor';
