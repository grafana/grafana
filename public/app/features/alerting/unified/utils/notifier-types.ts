import { NotificationChannelOption } from 'app/features/alerting/unified/types/alerting';

export function option(
  propertyName: string,
  label: string,
  description: string,
  rest: Partial<NotificationChannelOption> = {}
): NotificationChannelOption {
  return {
    propertyName,
    label,
    description,
    element: 'input',
    inputType: '',
    required: false,
    secure: false,
    placeholder: '',
    validationRule: '',
    showWhen: { field: '', is: '' },
    dependsOn: '',
    ...rest,
  };
}
