import React from 'react';
import { css } from 'emotion';
import { Button, DataLinkBuiltInVars, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, VariableOrigin } from '@grafana/data';
import { DataLinkConfig } from '../types';
import { DataLink } from './DataLink';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textWeak};
  `,
  dataLink: css`
    margin-bottom: ${theme.spacing.sm};
  `,
}));

type Props = {
  value?: DataLinkConfig[];
  onChange: (value: DataLinkConfig[]) => void;
};
export const DataLinks = (props: Props) => {
  const { value, onChange } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      <h3 className="page-heading">Data links</h3>

      <div className={styles.infoText}>
        Add links to existing fields. Links will be shown in log row details next to the field value.
      </div>

      <div className="gf-form-group">
        {value &&
          value.map((field, index) => {
            return (
              <DataLink
                className={styles.dataLink}
                key={index}
                value={field}
                onChange={newField => {
                  const newDataLinks = [...value];
                  newDataLinks.splice(index, 1, newField);
                  onChange(newDataLinks);
                }}
                onDelete={() => {
                  const newDataLinks = [...value];
                  newDataLinks.splice(index, 1);
                  onChange(newDataLinks);
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
            variant={'secondary'}
            className={css`
              margin-right: 10px;
            `}
            icon="fa fa-plus"
            onClick={event => {
              event.preventDefault();
              const newDataLinks = [...(value || []), { field: '', url: '' }];
              onChange(newDataLinks);
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </>
  );
};
