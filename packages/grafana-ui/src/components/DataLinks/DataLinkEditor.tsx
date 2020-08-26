import React, { ChangeEvent, useContext } from 'react';
import { VariableSuggestion, GrafanaTheme, DataLink, SelectableValue } from '@grafana/data';
import { Switch } from '../Switch/Switch';
import { css } from 'emotion';
import { ThemeContext, stylesFactory } from '../../themes/index';
import { DataLinkInput } from './DataLinkInput';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

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
    const modes: SelectableValue[] = [
      { label: 'Link', value: 'link' },
      { label: 'Pop Up', value: 'modal' },
    ];
    const defaultMode: SelectableValue = { label: 'Link', value: 'link' };
    const modalContentTypes: SelectableValue[] = [
      { label: 'Plain Text', value: 'plain_text' },
      { label: 'HTML', value: 'html' },
      { label: 'JSON', value: 'json' },
    ];
    const defaultModalContentType: SelectableValue = { label: 'Plain Text', value: 'plain_text' };
    const onModeChange = (selectableItem: SelectableValue) => {
      onChange(index, { ...value, mode: selectableItem.value });
    };
    const onUrlChange = (url: string, callback?: () => void) => {
      onChange(index, { ...value, url }, callback);
    };
    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, title: event.target.value });
    };
    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };
    const onModalContentTypeChange = (selectableItem: SelectableValue) => {
      onChange(index, { ...value, modalContentType: selectableItem.value });
    };
    const onModalTemplateChange = (modalTemplate: string, callback?: () => void) => {
      onChange(index, { ...value, modalTemplate }, callback);
    };
    return (
      <div className={styles.listItem}>
        <Field label="Mode">
          <Select
            value={modes.find((mode: any) => mode.value === value.mode) || defaultMode}
            onChange={onModeChange}
            options={modes}
            defaultValue={defaultMode}
            placeholder="Select Mode"
          />
        </Field>
        <Field label="Title">
          <Input value={value.title} onChange={onTitleChange} placeholder="Show details" />
        </Field>
        {value.mode === 'modal' ? (
          <>
            <Field label="Format">
              <Select
                value={
                  modalContentTypes.find((mode: any) => mode.value === value.modalContentType) ||
                  defaultModalContentType
                }
                onChange={onModalContentTypeChange}
                options={modalContentTypes}
                defaultValue={defaultModalContentType}
                placeholder="Format"
              />
            </Field>
            <Field label="HTML Template">
              <DataLinkInput
                value={value.modalTemplate || ''}
                onChange={onModalTemplateChange}
                suggestions={suggestions}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="URL">
              <DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />
            </Field>
            <Field label="Open in new tab">
              <Switch value={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
            </Field>
          </>
        )}
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
