import React, { useState } from 'react';
import { css } from 'emotion';
import { Button, DataLinkBuiltInVars, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, VariableOrigin } from '@grafana/data';
import { DerivedFieldConfig } from '../types';
import { DerivedField } from './DerivedField';
import { DebugSection } from './DebugSection';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textWeak};
  `,
  derivedField: css`
    margin-bottom: ${theme.spacing.sm};
  `,
}));

type Props = {
  value?: DerivedFieldConfig[];
  onChange: (value: DerivedFieldConfig[]) => void;
};
export const DerivedFields = (props: Props) => {
  const { value, onChange } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  const [showDebug, setShowDebug] = useState(false);

  return (
    <>
      <h3 className="page-heading">Derived fields</h3>

      <div className={styles.infoText}>
        Derived fields can be used to extract new fields from the log message and create link from it's value.
      </div>

      <div className="gf-form-group">
        {value &&
          value.map((field, index) => {
            return (
              <DerivedField
                className={styles.derivedField}
                key={index}
                value={field}
                onChange={newField => {
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
            variant={'inverse'}
            className={css`
              margin-right: 10px;
            `}
            icon="fa fa-plus"
            onClick={event => {
              event.preventDefault();
              const newDerivedFields = [...(value || []), { name: '', matcherRegex: '' }];
              onChange(newDerivedFields);
            }}
          >
            Add
          </Button>

          {value && value.length > 0 && (
            <Button variant="inverse" onClick={() => setShowDebug(!showDebug)}>
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
