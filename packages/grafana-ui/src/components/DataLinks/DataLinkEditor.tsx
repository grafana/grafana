import { css } from '@emotion/css';
import { memo, ChangeEvent } from 'react';

import { VariableSuggestion, GrafanaTheme2, DataLink } from '@grafana/data';

import { useStyles2 } from '../../themes/index';
import { isCompactUrl } from '../../utils/dataLinks';
import { Trans } from '../../utils/i18n';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { Switch } from '../Switch/Switch';

import { DataLinkInput } from './DataLinkInput';

interface DataLinkEditorProps {
  index: number;
  isLast: boolean;
  value: DataLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DataLink, callback?: () => void) => void;
}

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

export const DataLinkEditor = memo(({ index, value, onChange, suggestions, isLast }: DataLinkEditorProps) => {
  const styles = useStyles2(getStyles);

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

      <Field
        label="URL"
        invalid={isCompactUrl(value.url)}
        error="Data link is an Explore URL in a deprecated format. Please visit the URL to be redirected, and edit this data link to use that URL."
      >
        <DataLinkInput value={value.url} onChange={onUrlChange} suggestions={suggestions} />
      </Field>

      <Field label="Open in new tab">
        <Switch value={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
      </Field>

      {isLast && (
        <div className={styles.infoText}>
          <Trans i18nKey="grafana-ui.data-link-editor.info">
            With data links you can reference data variables like series name, labels and values. Type CMD+Space,
            CTRL+Space, or $ to open variable suggestions.
          </Trans>
        </div>
      )}
    </div>
  );
});

DataLinkEditor.displayName = 'DataLinkEditor';
