import { css } from '@emotion/css';
import { ChangeEvent, useEffect, useState } from 'react';
import * as React from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2, DataSourceInstanceSettings, VariableSuggestion } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, DataLinkInput, Field, Icon, Input, Label, Tooltip, useStyles2, Select, Switch } from '@grafana/ui';

import { DerivedFieldConfig } from '../types';

type MatcherType = 'label' | 'regex';

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'baseline',
  }),
  nameField: css({
    flex: 2,
    marginRight: theme.spacing(0.5),
  }),
  regexField: css({
    flex: 3,
    marginRight: theme.spacing(0.5),
  }),
  urlField: css({
    flex: 1,
    marginRight: theme.spacing(0.5),
  }),
  urlDisplayLabelField: css({
    flex: 1,
  }),
  internalLink: css({
    marginRight: theme.spacing(1),
  }),
  openNewTab: css({
    marginRight: theme.spacing(1),
  }),
  dataSource: css({}),
  nameMatcherField: css({
    width: theme.spacing(20),
    marginRight: theme.spacing(0.5),
  }),
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
  const [openInNewTab, setOpenInNewTab] = useState(!!value.targetBlank);
  const previousUid = usePrevious(value.datasourceUid);
  const [fieldType, setFieldType] = useState<MatcherType>(value.matcherType ?? 'regex');

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

  const invalidName = !validateName(value.name);

  return (
    <div className={className} data-testid="derived-field">
      <div className="gf-form">
        <Field className={styles.nameField} label="Name" invalid={invalidName} error="The name is already in use">
          <Input value={value.name} onChange={handleChange('name')} placeholder="Field name" invalid={invalidName} />
        </Field>
        <Field
          className={styles.nameMatcherField}
          label={
            <TooltipLabel
              label="Type"
              content="Derived fields can be created from labels or by applying a regular expression to the log message."
            />
          }
        >
          <Select
            options={[
              { label: 'Regex in log line', value: 'regex' },
              { label: 'Label', value: 'label' },
            ]}
            value={fieldType}
            onChange={(type) => {
              // make sure this is a valid MatcherType
              if (type.value === 'label' || type.value === 'regex') {
                setFieldType(type.value);
                onChange({
                  ...value,
                  matcherType: type.value,
                });
              }
            }}
          />
        </Field>
        <Field
          className={styles.regexField}
          label={
            <>
              {fieldType === 'regex' && (
                <TooltipLabel
                  label="Regex"
                  content="Use to parse and capture some part of the log message. You can use the captured groups in the template."
                />
              )}

              {fieldType === 'label' && <TooltipLabel label="Label" content="Use to derive the field from a label." />}
            </>
          }
        >
          <Input value={value.matcherRegex} onChange={handleChange('matcherRegex')} />
        </Field>
        <Field label="">
          <Button
            variant="destructive"
            aria-label="Remove field"
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

      <div className="gf-form">
        <Field label="Internal link" className={styles.internalLink}>
          <Switch
            value={showInternalLink}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const { checked } = e.currentTarget;
              if (!checked) {
                onChange({
                  ...value,
                  datasourceUid: undefined,
                });
              }
              setShowInternalLink(checked);
            }}
          />
        </Field>

        {showInternalLink && (
          <Field label="" className={styles.dataSource}>
            <DataSourcePicker
              tracing={true}
              onChange={(ds: DataSourceInstanceSettings) =>
                onChange({
                  ...value,
                  datasourceUid: ds.uid,
                })
              }
              current={value.datasourceUid}
              noDefault
            />
          </Field>
        )}
      </div>

      <div className="gf-form">
        <Field label="Open in new tab" className={styles.openNewTab}>
          <Switch
            value={openInNewTab}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const { checked } = e.currentTarget;
              onChange({
                ...value,
                targetBlank: checked,
              });
              setOpenInNewTab(checked);
            }}
          />
        </Field>
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
