import React from 'react';

import { PanelModel, PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';

import { AnnoListPanel } from './AnnoListPanel';
import { defaultPanelOptions, PanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions>(AnnoListPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        category: ['Annotation query'],
        path: 'onlyFromThisDashboard',
        name: 'Query filter',
        defaultValue: defaultPanelOptions.onlyFromThisDashboard,
        settings: {
          options: [
            { value: false, label: 'All dashboards' },
            { value: true, label: 'This dashboard' },
          ] as any, // does not like boolean, but works fine!
        },
      })
      .addRadio({
        category: ['Annotation query'],
        path: 'onlyInTimeRange',
        name: 'Time range',
        defaultValue: false,
        settings: {
          options: [
            { value: false, label: 'None' },
            { value: true, label: 'This dashboard' },
          ] as any, // does not like boolean, but works fine!
        },
      })
      .addCustomEditor({
        category: ['Annotation query'],
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: 'Match annotation tags',
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      })
      .addNumberInput({
        category: ['Annotation query'],
        path: 'limit',
        name: 'Limit',
        defaultValue: 10,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showUser',
        name: 'Show user',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showTime',
        name: 'Show time',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showTags',
        name: 'Show tags',
        defaultValue: true,
      })
      .addRadio({
        category: ['Link behavior'],
        path: 'navigateToPanel',
        name: 'Link target',
        defaultValue: true,
        settings: {
          options: [
            { value: true, label: 'Panel' },
            { value: false, label: 'Dashboard' },
          ] as any, // does not like boolean, but works fine!
        },
      })
      .addTextInput({
        category: ['Link behavior'],
        path: 'navigateBefore',
        name: 'Time before',
        defaultValue: '10m',
        description: '',
      })
      .addTextInput({
        category: ['Link behavior'],
        path: 'navigateAfter',
        name: 'Time after',
        defaultValue: '10m',
        description: '',
      });
  })
  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((panel: PanelModel<PanelOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions as PanelOptions;
    }
    return panel.options;
  });
