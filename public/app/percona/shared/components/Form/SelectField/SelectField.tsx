import React, { FC } from 'react';
import { Select } from '@grafana/ui';
import { SelectCommonProps } from '@grafana/ui/src/components/Select/types';
import { withSelectStyles } from '../withSelectStyles/withSelectStyles';
import { Label } from '@percona/platform-core';
import { LabeledFieldProps } from '@percona/platform-core/dist/shared/types';

const SelectFieldWrapper: FC<LabeledFieldProps & SelectCommonProps<any>> = ({
  label,
  name,
  required,
  inputId,
  tooltipLink,
  tooltipText,
  tooltipLinkText,
  tooltipDataTestId,
  tooltipIcon,
  tooltipLinkTarget,
  ...props
}) => (
  <>
    <Label
      name={name}
      label={label}
      required={required}
      inputId={inputId}
      tooltipLink={tooltipLink}
      tooltipLinkText={tooltipLinkText}
      tooltipText={tooltipText}
      tooltipDataTestId={tooltipDataTestId}
      tooltipLinkTarget={tooltipLinkTarget}
      tooltipIcon={tooltipIcon}
    />
    <Select {...props} />
  </>
);

export const SelectField = withSelectStyles(SelectFieldWrapper);
