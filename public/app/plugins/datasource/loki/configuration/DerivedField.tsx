import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, DataLinkInput, Field, Icon, Input, Label, LegacyForms, Tooltip, useStyles2 } from '@grafana/ui';

import { DerivedFieldConfig } from '../types';

const { Switch } = LegacyForms;

const getStyles = (theme: GrafanaTheme2) => ({
  row: css`
    display: flex;
    align-items: baseline;
  `,
  nameField: css`
    flex: 2;
    margin-right: ${theme.spacing(0.5)};
  `,
  regexField: css`
    flex: 3;
    margin-right: ${theme.spacing(0.5)};
  `,
  urlField: css`
    flex: 1;
    margin-right: ${theme.spacing(0.5)};
  `,
  urlDisplayLabelField: css`
    flex: 1;
  `,
});

type Props = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
  validateName: (name: string) => boolean;
};
export const DerivedField = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className, validateName } = props;
  const styles = useStyles2(getStyles);
  const [showInternalLink, setShowInternalLink] = useState(!!value.datasourceUid);
  const previousUid = usePrevious(value.datasourceUid);

  // Force internal link visibility change if uid changed outside of this component.
  useEffect(() => {
    if (!previousUid && value.datasourceUid && !showInternalLink) {
      setShowInternalLink(true);
    }
    if (previousUid && !value.datasourceUid && showInternalLink) {
      setShowInternalLink(false);
    }
  }, [previousUid, value.datasourceUid, showInternalLink]);

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  const invalidName = validateName(value.name);

  return (
    <div className={className} data-testid="derived-field">
      <div className="gf-form">
        <Field className={styles.nameField} label="Name" invalid={invalidName} error="The name is already in use">
          <Input value={value.name} onChange={handleChange('name')} placeholder="Field name" invalid={invalidName} />
        </Field>
        <Field
          className={styles.regexField}
          label={
            <TooltipLabel
              label="Regex"
              content="Use to parse and capture some part of the log message. You can use the captured groups in the template."
            />
          }
          onChange={handleChange('matcherRegex')}
        >
          <Input value={value.matcherRegex} onChange={handleChange('matcherRegex')} />
        </Field>
        <Field label="">
          <Button
            variant="destructive"
            title="Remove field"
            icon="times"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
          />
        </Field>
      </div>

      <div className="gf-form">
        <Field label={showInternalLink ? 'Query' : 'URL'} className={styles.urlField}>
          <DataLinkInput
            placeholder={showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}'}
            value={value.url || ''}
            onChange={(newValue) =>
              onChange({
                ...value,
                url: newValue,
              })
            }
            suggestions={suggestions}
          />
        </Field>
        <Field
          className={styles.urlDisplayLabelField}
          label={
            <TooltipLabel
              label="URL Label"
              content="Use to override the button label when this derived field is found in a log."
            />
          }
        >
          <Input value={value.urlDisplayLabel} onChange={handleChange('urlDisplayLabel')} />
        </Field>
      </div>

      <div className={styles.row}>
        <Switch
          label="Internal link"
          checked={showInternalLink}
          onChange={() => {
            if (showInternalLink) {
              onChange({
                ...value,
                datasourceUid: undefined,
              });
            }
            setShowInternalLink(!showInternalLink);
          }}
        />

        {showInternalLink && (
          <DataSourcePicker
            tracing={true}
            onChange={(ds) =>
              onChange({
                ...value,
                datasourceUid: ds.uid,
              })
            }
            current={value.datasourceUid}
          />
        )}
      </div>
    </div>
  );
};

const TooltipLabel = ({ content, label }: { content: string; label: string }) => (
  <Label>
    {label}
    <Tooltip placement="top" content={content} theme="info">
      <Icon tabIndex={0} name="info-circle" size="sm" style={{ marginLeft: '10px' }} />
    </Tooltip>
  </Label>
);
