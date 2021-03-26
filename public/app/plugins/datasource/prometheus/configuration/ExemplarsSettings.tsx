import { Button } from '@grafana/ui';
import { css } from 'emotion';
import React from 'react';
import { ExemplarTraceIdDestination } from '../types';
import ExemplarSetting from './ExemplarSetting';

type Props = {
  options?: ExemplarTraceIdDestination[];
  onChange: (value: ExemplarTraceIdDestination[]) => void;
};

export function ExemplarsSettings({ options, onChange }: Props) {
  return (
    <>
      <h3 className="page-heading">Exemplars</h3>

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
            />
          );
        })}

      <Button
        variant="secondary"
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
    </>
  );
}
