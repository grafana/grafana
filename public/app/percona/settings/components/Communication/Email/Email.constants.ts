import { SelectableValue } from '@grafana/data';
import { EmailAuthType } from '../../../Settings.types';

export const emailOptions: Array<SelectableValue<EmailAuthType>> = [
  {
    value: EmailAuthType.NONE,
    label: 'None',
  },
  {
    value: EmailAuthType.PLAIN,
    label: 'Plain',
  },
  {
    value: EmailAuthType.LOGIN,
    label: 'Login',
  },
  {
    value: EmailAuthType.CRAM,
    label: 'CRAM-MD5',
  },
];
