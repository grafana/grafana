import {
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormGetValues,
  type UseFormHandleSubmit,
  type UseFormSetError,
} from 'react-hook-form';

import { type RuleFormValues } from '../types/rule-form';

import { validateRequiredAlertAnnotations } from './alert-annotations';

export function createAlertRuleSubmitHandler(
  getValues: UseFormGetValues<RuleFormValues>,
  setError: UseFormSetError<RuleFormValues>,
  onValid: SubmitHandler<RuleFormValues>,
  onInvalid?: SubmitErrorHandler<RuleFormValues>
) {
  return (values: RuleFormValues) => {
    if (!validateRequiredAlertAnnotations(getValues(), setError)) {
      onInvalid?.({});
      return;
    }

    return onValid(values);
  };
}

export function bindAlertRuleFormSubmit(
  handleSubmit: UseFormHandleSubmit<RuleFormValues>,
  getValues: UseFormGetValues<RuleFormValues>,
  setError: UseFormSetError<RuleFormValues>,
  onValid: SubmitHandler<RuleFormValues>,
  onInvalid?: SubmitErrorHandler<RuleFormValues>
) {
  return handleSubmit(createAlertRuleSubmitHandler(getValues, setError, onValid, onInvalid), onInvalid);
}
