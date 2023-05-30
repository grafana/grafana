import { css } from '@emotion/css';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, useTheme2 } from '@grafana/ui';

import { ExemplarTraceIdDestination } from '../types';

import { overhaulStyles } from './ConfigEditor';
import ExemplarSetting from './ExemplarSetting';

type Props = {
  options?: ExemplarTraceIdDestination[];
  onChange: (value: ExemplarTraceIdDestination[]) => void;
  disabled?: boolean;
};

export function ExemplarsSettings({ options, onChange, disabled }: Props) {
  const theme = useTheme2();
  const styles = overhaulStyles(theme);
  return (
    <div className={styles.sectionBottomPadding}>
      <h6 className="page-heading">Exemplars</h6>

      {options &&
        options.map((option, index) => {
          return (
            <ExemplarSetting
              key={index}
              value={option}
              onChange={(newField) => {
                const newOptions = [...options];
                newOptions.splice(index, 1, newField);
                onChange(newOptions);
              }}
              onDelete={() => {
                const newOptions = [...options];
                newOptions.splice(index, 1);
                onChange(newOptions);
              }}
              disabled={disabled}
            />
          );
        })}

      {!disabled && (
        <Button
          variant="secondary"
          aria-label={selectors.components.DataSource.Prometheus.configPage.exemplarsAddButton}
          className={css`
            margin-bottom: 10px;
          `}
          icon="plus"
          onClick={(event) => {
            event.preventDefault();
            const newOptions = [...(options || []), { name: 'traceID' }];
            onChange(newOptions);
          }}
        >
          Add
        </Button>
      )}
      {disabled && !options && <i>No exemplars configurations</i>}
    </div>
  );
}
