import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { Button, useTheme2 } from '@grafana/ui';

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
  value?: DerivedFieldConfig[];
  onChange: (value: DerivedFieldConfig[]) => void;
};

export const DerivedFields = ({ value = [], onChange }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [showDebug, setShowDebug] = useState(false);

  return (
    <>
      <h3 className="page-heading">Derived fields</h3>

      <div className={styles.infoText}>
        Derived fields can be used to extract new fields from a log message and create a link from its value.
      </div>

      <div className="gf-form-group">
        {value.map((field, index) => {
          return (
            <DerivedField
              className={styles.derivedField}
              key={index}
              value={field}
              onChange={(newField) => {
                const newDerivedFields = [...value];
                newDerivedFields.splice(index, 1, newField);
                onChange(newDerivedFields);
              }}
              onDelete={() => {
                const newDerivedFields = [...value];
                newDerivedFields.splice(index, 1);
                onChange(newDerivedFields);
              }}
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
              const newDerivedFields = [...value, { name: '', matcherRegex: '' }];
              onChange(newDerivedFields);
            }}
          >
            Add
          </Button>

          {value.length > 0 && (
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
            derivedFields={value}
          />
        </div>
      )}
    </>
  );
};
