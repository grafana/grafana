import { Messages } from './AdditionalOptions.messages';
import {
  AutoDiscoveryOptionsInterface,
  TablestatOptionsInterface,
  MaxConnectionLimitOptionsInterface,
} from './AdditionalOptions.types';

export const tablestatOptions = [
  {
    value: TablestatOptionsInterface.disabled,
    label: Messages.form.tablestatOptions.disabled,
  },
  {
    value: TablestatOptionsInterface.default,
    label: Messages.form.tablestatOptions.default,
  },
  {
    value: TablestatOptionsInterface.custom,
    label: Messages.form.tablestatOptions.custom,
  },
];

export const autoDiscoveryOptions = [
  {
    value: AutoDiscoveryOptionsInterface.enabled,
    label: Messages.form.autoDiscoveryOptions.enabled,
  },
  {
    value: AutoDiscoveryOptionsInterface.disabled,
    label: Messages.form.autoDiscoveryOptions.disabled,
  },
  {
    value: AutoDiscoveryOptionsInterface.custom,
    label: Messages.form.autoDiscoveryOptions.custom,
  },
];

export const maxConnectionLimitOptions = [
  {
    value: MaxConnectionLimitOptionsInterface.enabled,
    label: Messages.form.maxConnectionLimitOptions.enabled,
  },
  {
    value: MaxConnectionLimitOptionsInterface.disabled,
    label: Messages.form.maxConnectionLimitOptions.disabled,
  },
];
