import React, { useState } from 'react';
import { css } from 'emotion';
import { Button, DataLinkBuiltInVars, GrafanaTheme, stylesFactory, useTheme, VariableOrigin } from '@grafana/ui';
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
  value: DerivedFieldConfig[] | undefined;
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
        Derived fields can be used to extract new fields from the log message and create Data Link from it's value.
      </div>

      <div className="gf-form-group">
        <Button variant="inverse" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? 'Hide debug' : 'Debug'}
        </Button>
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
                    value: `${DataLinkBuiltInVars.valueText}`,
                    label: 'Text',
                    documentation: 'Text representation of selected value',
                    origin: VariableOrigin.Value,
                  },
                ]}
              />
            );
          })}
        <div>
          <Button
            variant={'inverse'}
            icon="fa fa-plus"
            onClick={event => {
              event.preventDefault();
              const newDerivedFields = [...(value || []), { name: '', matcherRegex: '' }];
              onChange(newDerivedFields);
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </>
  );
};
