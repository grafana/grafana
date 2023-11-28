/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React, { FC } from 'react';

import { MultiSelect } from '@grafana/ui';
import { MultiSelectCommonProps } from '@grafana/ui/src/components/Select/types';
import { LabelCore } from 'app/percona/shared/components/Form/LabelCore';
import { LabeledFieldProps } from 'app/percona/shared/helpers/types';

import { withSelectStyles } from '../withSelectStyles/withSelectStyles';

const MultiSelectFieldWrapper: FC<React.PropsWithChildren<LabeledFieldProps & MultiSelectCommonProps<any>>> = ({
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
    <MultiSelect {...props} />
  </>
);

export const MultiSelectField = withSelectStyles(MultiSelectFieldWrapper);
