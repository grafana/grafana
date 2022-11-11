import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { DataLinkConfig } from '../types';

import { DataLink } from './DataLink';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    infoText: css`
      padding-bottom: ${theme.spacing(2)};
      color: ${theme.colors.text.secondary};
    `,
    dataLink: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};

export type Props = {
  value?: DataLinkConfig[];
  onChange: (value: DataLinkConfig[]) => void;
};
export const DataLinks = (props: Props) => {
  const { value, onChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <>
      <h3 className="page-heading">Data links</h3>

      <div className={styles.infoText}>
        Add links to existing fields. Links will be shown in log row details next to the field value.
      </div>

      {value && value.length > 0 && (
        <div className="gf-form-group">
          {value.map((field, index) => {
            return (
              <DataLink
                className={styles.dataLink}
                key={index}
                value={field}
                onChange={(newField) => {
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
        </div>
      )}

      <Button
        type="button"
        variant={'secondary'}
        className={css`
          margin-right: 10px;
        `}
        icon="plus"
        onClick={(event) => {
          event.preventDefault();
          const newDataLinks = [...(value || []), { field: '', url: '' }];
          onChange(newDataLinks);
        }}
      >
        Add
      </Button>
    </>
  );
};
