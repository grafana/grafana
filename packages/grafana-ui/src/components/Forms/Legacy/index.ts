import { FormField } from '../../FormField/FormField';
import { Input, LegacyInputStatus } from './Input/Input';
import { IndicatorsContainer } from './Select/IndicatorsContainer';
import { NoOptionsMessage } from './Select/NoOptionsMessage';
import { AsyncSelect, Select } from './Select/Select';
import { Switch } from './Switch/Switch';
import { SecretFormField } from '../../SecretFormField/SecretFormField';

/** @deprecated Please use non-legacy versions of these components */
const LegacyForms = {
  SecretFormField,
  FormField,
  Select,
  AsyncSelect,
  IndicatorsContainer,
  NoOptionsMessage,
  Input,
  Switch,
};
export { LegacyForms, LegacyInputStatus };
