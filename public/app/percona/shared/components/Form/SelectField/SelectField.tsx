/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React, { FC } from 'react';

import { Select } from '@grafana/ui';
import { SelectCommonProps } from '@grafana/ui/src/components/Select/types';
import { LabelCore } from 'app/percona/shared/components/Form/LabelCore';
import { LabeledFieldProps } from 'app/percona/shared/helpers/types';

import { withSelectStyles } from '../withSelectStyles/withSelectStyles';

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
    <LabelCore
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
