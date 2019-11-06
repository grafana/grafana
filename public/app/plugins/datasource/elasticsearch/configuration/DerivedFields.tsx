import React from 'react';
import { css } from 'emotion';
import { Button, DataLinkBuiltInVars, stylesFactory, useTheme, VariableOrigin } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { DerivedFieldConfig } from '../types';
import { DerivedField } from './DerivedField';

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

  return (
    <>
      <h3 className="page-heading">Field enhancement</h3>

      <div className={styles.infoText}>You can add links to existing fields.</div>

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
                    documentation: 'Raw value of the field',
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
              const newDerivedFields = [...(value || []), { pattern: '', url: '' }];
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
