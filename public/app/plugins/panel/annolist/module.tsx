import React from 'react';
import { PanelModel, PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';
import { AnnoListPanel } from './AnnoListPanel';
import { AnnoOptions } from './types';

export const plugin = new PanelPlugin<AnnoOptions>(AnnoListPanel)
  .setPanelOptions(builder => {
    builder
      .addBooleanSwitch({
        path: 'showUser',
        name: 'Show user',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showTime',
        name: 'Show time',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showTags',
        name: 'Show tags',
        description: '',
        defaultValue: true,
      })
      .addTextInput({
        path: 'navigateBefore',
        name: 'Before',
        defaultValue: '10m',
        description: '',
      })
      .addTextInput({
        path: 'navigateAfter',
        name: 'After',
        defaultValue: '10m',
        description: '',
      })
      .addBooleanSwitch({
        path: 'navigateToPanel',
        name: 'To panel',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'onlyFromThisDashboard',
        name: 'Only this dashboard',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'onlyInTimeRange',
        name: 'Within Time Range',
        description: '',
        defaultValue: false,
      })
      .addCustomEditor({
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: '',
        editor: props => {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      })
      .addNumberInput({
        path: 'limit',
        name: 'Limit',
        description: '',
        defaultValue: 10,
      });
  })
  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((panel: PanelModel<AnnoOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions as AnnoOptions;
    }
    return panel.options;
  });
