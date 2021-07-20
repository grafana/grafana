import React from 'react';
import { PanelModel, PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';
import { AnnoListPanel } from './AnnoListPanel';
import { AnnoOptions } from './types';

export const plugin = new PanelPlugin<AnnoOptions>(AnnoListPanel)
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        category: ['Annotation query'],
        path: 'onlyFromThisDashboard',
        name: 'This dashboard',
        description: 'Only return annotations on this dashboard',
        defaultValue: false,
      })
      .addBooleanSwitch({
        category: ['Annotation query'],
        path: 'onlyInTimeRange',
        name: 'Within Time Range',
        description: 'Show annotations that match the dashboard time range',
        defaultValue: false,
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
      })
      .addBooleanSwitch({
        category: ['Link behavior'],
        path: 'navigateToPanel',
        name: 'Link to panel',
        description: '',
        defaultValue: true,
      });
  })
  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((panel: PanelModel<AnnoOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions as AnnoOptions;
    }
    return panel.options;
  });
