import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, DataLinkInput, LegacyForms, useStyles2 } from '@grafana/ui';

import { DerivedFieldConfig } from '../types';

const { Switch, FormField } = LegacyForms;

const getStyles = (theme: GrafanaTheme2) => ({
  row: css`
    display: flex;
    align-items: baseline;
  `,
  nameField: css`
    flex: 2;
  `,
  regexField: css`
    flex: 3;
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
};
export const DerivedField = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className } = props;
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

  return (
    <div className={className} data-testid="derived-field">
      <div className="gf-form">
        <FormField
          labelWidth={10}
          className={styles.nameField}
          // A bit of a hack to prevent using default value for the width from FormField
          inputWidth={null}
          label="Name"
          type="text"
          value={value.name}
          onChange={handleChange('name')}
        />
        <FormField
          labelWidth={10}
          className={styles.regexField}
          inputWidth={null}
          label="Regex"
          type="text"
          value={value.matcherRegex}
          onChange={handleChange('matcherRegex')}
          tooltip={
            'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
          }
        />
        <Button
          variant="destructive"
          title="Remove field"
          icon="times"
          onClick={(event) => {
            event.preventDefault();
            onDelete();
          }}
        />
      </div>

      <div className="gf-form">
        <FormField
          labelWidth={10}
          label={showInternalLink ? 'Query' : 'URL'}
          inputEl={
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
          }
          className={styles.urlField}
        />
        <FormField
          className={styles.urlDisplayLabelField}
          labelWidth={10}
          inputWidth={null}
          label="URL Label"
          type="text"
          value={value.urlDisplayLabel}
          onChange={handleChange('urlDisplayLabel')}
          tooltip={'Use to override the button label when this derived field is found in a log.'}
        />
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
