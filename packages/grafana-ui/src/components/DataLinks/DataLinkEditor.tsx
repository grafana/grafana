import React, { ChangeEvent, useContext } from 'react';
import { VariableSuggestion, GrafanaTheme, DataLink } from '@grafana/data';
import { Switch } from '../Switch/Switch';
import { css } from 'emotion';
import { ThemeContext, stylesFactory } from '../../themes/index';
import { DataLinkInput } from './DataLinkInput';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

interface DataLinkEditorProps {
  index: number;
  isLast: boolean;
  value: DataLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DataLink, callback?: () => void) => void;
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
  ({ index, value, onChange, suggestions, isLast }) => {
    const theme = useContext(ThemeContext);
    const styles = getStyles(theme);

    const onUrlChange = (url: string, callback?: () => void) => {
      onChange(index, { ...value, url }, callback);
    };
    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, title: event.target.value });
    };

    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };

    return (
      <div className={styles.listItem}>
        <Field label="Title">
          <Input value={value.title} onChange={onTitleChange} placeholder="Show details" />
        </Field>

        <Field label="URL">
          <DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />
        </Field>

        <Field label="Open in new tab">
          <Switch value={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
        </Field>

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
