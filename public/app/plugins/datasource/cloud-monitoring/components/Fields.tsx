import { css } from '@emotion/css';
import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { HorizontalGroup, InlineField, InlineLabel, PopoverContent, Select } from '@grafana/ui';

import { INNER_LABEL_WIDTH, LABEL_WIDTH } from '../constants';

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string;
  label: string;
  allowCustomValue?: boolean;
}

export const VariableQueryField: FC<VariableQueryFieldProps> = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
}) => {
  return (
    <InlineField label={label} labelWidth={20}>
      <Select
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
      />
    </InlineField>
  );
};

export interface Props {
  children: React.ReactNode;
  tooltip?: PopoverContent;
  label?: React.ReactNode;
  className?: string;
  noFillEnd?: boolean;
  labelWidth?: number;
  fillComponent?: React.ReactNode;
  htmlFor?: string;
}

export const QueryEditorRow: FC<Props> = ({
  children,
  label,
  tooltip,
  fillComponent,
  noFillEnd = false,
  labelWidth = LABEL_WIDTH,
  htmlFor,
  ...rest
}) => {
  return (
    <div className="gf-form" {...rest}>
      {label && (
        <InlineLabel width={labelWidth} tooltip={tooltip} htmlFor={htmlFor}>
          {label}
        </InlineLabel>
      )}
      <div
        className={css`
          margin-right: 4px;
        `}
      >
        <HorizontalGroup spacing="xs" width="auto">
          {children}
        </HorizontalGroup>
      </div>
      <div className={'gf-form--grow'}>
        {noFillEnd || <div className={'gf-form-label gf-form-label--grow'}>{fillComponent}</div>}
      </div>
    </div>
  );
};

export const QueryEditorField: FC<Props> = ({ children, label, tooltip, labelWidth = INNER_LABEL_WIDTH, ...rest }) => {
  return (
    <>
      {label && (
        <InlineLabel width={labelWidth} tooltip={tooltip} {...rest}>
          {label}
        </InlineLabel>
      )}
      {children}
    </>
  );
};
