import React from 'react';
import { PanelPlugin } from '@grafana/data';
import { AMNotificationsOptions } from './types';
import { AMNotifications } from './AMNotifications';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';

export const plugin = new PanelPlugin<AMNotificationsOptions>(AMNotifications).setPanelOptions((builder) => {
  return builder;
  // return builder.addTextInput({
  //   name: 'Labels',
  //   path: 'labels',
  //   category: ['Filter'],
  // });
  // .addCustomEditor({
  //   name: 'Alertmanager',
  //   path: 'alertmanager',
  //   id: 'alertmanager',
  //   defaultValue: null,
  //   category: ['Options'],
  //   editor: function RenderAlertmanagerPicker(props) {
  //     return (
  //       <AlertManagerPicker
  //         onChange={(alertManagerSourceName) => {
  //           return props.onChange(alertManagerSourceName);
  //         }}
  //       />
  //     );
  //   },
  // });
});
