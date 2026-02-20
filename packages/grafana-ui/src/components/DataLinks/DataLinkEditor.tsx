import { css } from '@emotion/css';
import { memo, ChangeEvent, useRef } from 'react';

import { VariableSuggestion, GrafanaTheme2, DataLink } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';
import { Input } from '../Input/Input';
import { Switch } from '../Switch/Switch';

import { DataLinkInput } from './DataLinkInput';

interface DataLinkEditorProps {
  index: number;
  isLast: boolean;
  value: DataLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DataLink, callback?: () => void) => void;
  showOneClick?: boolean;
}

export const DataLinkEditor = memo(
  ({ index, value, onChange, suggestions, isLast, showOneClick = false }: DataLinkEditorProps) => {
    const styles = useStyles2(getStyles);
    const urlInputRef = useRef<HTMLDivElement>(null);

    const onUrlChange = (url: string, callback?: () => void) => {
      onChange(index, { ...value, url }, callback);
    };

    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, title: event.target.value });
    };

    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };

    const onOneClickChanged = () => {
      onChange(index, { ...value, oneClick: !value.oneClick });
    };

    return (
      <div className={styles.listItem}>
        <Field label={t('grafana-ui.data-link-editor.title-label', 'Title')}>
          <Input
            id="link-title"
            value={value.title}
            onChange={onTitleChange}
            placeholder={t('grafana-ui.data-link-editor.title-placeholder', 'Show details')}
          />
        </Field>

        <Field
          label={
            <Label
              id="link-url-label"
              onClick={() => {
                urlInputRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
              }}
            >
              {t('grafana-ui.data-link-editor.url-label', 'URL')}
            </Label>
          }
        >
          <DataLinkInput
            ref={urlInputRef}
            ariaLabelledBy="link-url-label"
            value={value.url}
            onChange={onUrlChange}
            suggestions={suggestions}
          />
        </Field>

        <Field label={t('grafana-ui.data-link-editor.new-tab-label', 'Open in new tab')}>
          <Switch id="new-tab-toggle" value={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
        </Field>

        {showOneClick && (
          <Field
            label={t('grafana-ui.data-link-inline-editor.one-click', 'One click')}
            description={t(
              'grafana-ui.data-link-editor-modal.one-click-description',
              'Only one link can have one click enabled at a time'
            )}
          >
            <Switch id="one-click-toggle" value={value.oneClick || false} onChange={onOneClickChanged} />
          </Field>
        )}

        {isLast && (
          <Trans i18nKey="grafana-ui.data-link-editor.info" className={styles.infoText}>
            With data links you can reference data variables like series name, labels and values. Type CMD+Space,
            CTRL+Space, or $ to open variable suggestions.
          </Trans>
        )}
      </div>
    );
  }
);

DataLinkEditor.displayName = 'DataLinkEditor';

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    marginBottom: theme.spacing(),
  }),
  infoText: css({
    paddingBottom: theme.spacing(2),
    marginLeft: '66px',
    color: theme.colors.text.secondary,
  }),
});
