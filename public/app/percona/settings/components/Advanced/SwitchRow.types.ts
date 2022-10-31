/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangeEvent } from 'react';

export interface SwitchRowProps {
  label?: string;
  tooltip?: React.ReactNode;
  tooltipLinkText?: string;
  link?: string;
  disabled?: boolean;
  className?: string;
  dataTestId?: string;
  input: any;
  onChange?: (event: ChangeEvent, input: HTMLInputElement) => void;
}
