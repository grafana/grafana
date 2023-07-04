import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2, VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { Button, useTheme2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';

import { DerivedFieldConfig } from '../types';

import { DebugSection } from './DebugSection';
import { DerivedField } from './DerivedField';

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css`
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
  derivedField: css`
    margin-bottom: ${theme.spacing(1)};
  `,
});

type Props = {
  fields?: DerivedFieldConfig[];
  onChange: (value: DerivedFieldConfig[]) => void;
};

export const DerivedFields = ({ fields = [], onChange }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [showDebug, setShowDebug] = useState(false);

  const validateName = useCallback(
    (name: string) => {
      return fields.filter((field) => field.name && field.name === name).length <= 1;
    },
    [fields]
  );

  return (
    <ConfigSubSection
      title="Derived fields"
      description={
        <ConfigDescriptionLink
          description="Derived fields can be used to extract new fields from a log message and create a link from its value."
          suffix="loki/#configure-derived-fields"
          feature="derived fields"
        />
      }
    >
      <div className="gf-form-group">
        {fields.map((field, index) => {
          return (
            <DerivedField
              className={styles.derivedField}
              key={index}
              value={field}
              onChange={(newField) => {
                const newDerivedFields = [...fields];
                newDerivedFields.splice(index, 1, newField);
                onChange(newDerivedFields);
              }}
              onDelete={() => {
                const newDerivedFields = [...fields];
                newDerivedFields.splice(index, 1);
                onChange(newDerivedFields);
              }}
              validateName={validateName}
              suggestions={[
                {
                  value: DataLinkBuiltInVars.valueRaw,
                  label: 'Raw value',
                  documentation: 'Exact string captured by the regular expression',
                  origin: VariableOrigin.Value,
                },
              ]}
            />
          );
        })}
        <div>
          <Button
            variant="secondary"
            className={css`
              margin-right: 10px;
            `}
            icon="plus"
            onClick={(event) => {
              event.preventDefault();
              const newDerivedFields = [...fields, { name: '', matcherRegex: '', urlDisplayLabel: '', url: '' }];
              onChange(newDerivedFields);
            }}
          >
            Add
          </Button>

          {fields.length > 0 && (
            <Button variant="secondary" type="button" onClick={() => setShowDebug(!showDebug)}>
              {showDebug ? 'Hide example log message' : 'Show example log message'}
            </Button>
          )}
        </div>
      </div>

      {showDebug && (
        <div className="gf-form-group">
          <DebugSection
            className={css`
              margin-bottom: 10px;
            `}
            derivedFields={fields}
          />
        </div>
      )}
    </ConfigSubSection>
  );
};
