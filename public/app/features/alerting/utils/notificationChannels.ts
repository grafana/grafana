import memoizeOne from 'memoize-one';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { NotificationChannelDTO, NotificationChannelType } from 'app/types';

export const defaultValues: NotificationChannelDTO = {
  id: -1,
  name: '',
  type: { value: 'email', label: 'Email' },
  sendReminder: false,
  disableResolveMessage: false,
  frequency: '15m',
  settings: {
    uploadImage: config.rendererAvailable,
    autoResolve: true,
    httpMethod: 'POST',
    severity: 'critical',
  },
  secureSettings: {},
  secureFields: {},
  isDefault: false,
};

export const mapChannelsToSelectableValue = memoizeOne(
  (notificationChannels: NotificationChannelType[], includeDescription: boolean): Array<SelectableValue<string>> => {
    return notificationChannels.map((channel) => {
      if (includeDescription) {
        return {
          value: channel.value,
          label: channel.label,
          description: channel.description,
        };
      }
      return {
        value: channel.value,
        label: channel.label,
      };
    });
  }
);

export const transformSubmitData = (formData: NotificationChannelDTO) => {
  /*
    Some settings can be options in a select, in order to not save a SelectableValue<T>
    we need to use check if it is a SelectableValue and use its value.
  */
  const settings = Object.fromEntries(
    Object.entries(formData.settings).map(([key, value]) => {
      return [key, value && value.hasOwnProperty('value') ? value.value : value];
    })
  );

  return {
    ...defaultValues,
    ...formData,
    frequency: formData.frequency === '' ? defaultValues.frequency : formData.frequency,
    type: formData.type.value,
    settings: { ...defaultValues.settings, ...settings },
    secureSettings: { ...formData.secureSettings },
  };
};

export const transformTestData = (formData: NotificationChannelDTO) => {
  return {
    name: formData.name,
    type: formData.type.value,
    frequency: formData.frequency ?? defaultValues.frequency,
    settings: { ...Object.assign(defaultValues.settings, formData.settings) },
    secureSettings: { ...formData.secureSettings },
  };
};
