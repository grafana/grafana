import { ReactNode } from 'react';

import { IconName } from '@grafana/ui';

export interface LabelTooltipProps {
  tooltipText?: string;
  tooltipLink?: string;
  tooltipLinkText?: string;
  tooltipIcon?: IconName;
  tooltipDataTestId?: string;
  tooltipLinkTarget?: string;
  tooltipInteractive?: boolean;
}

export interface LabeledFieldProps extends LabelTooltipProps {
  label?: ReactNode;
  labelWrapperClassName?: string;
  labelClassName?: string;
  name: string;
  inputId?: string;
  required?: boolean;
}
