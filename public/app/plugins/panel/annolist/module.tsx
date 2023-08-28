import React from 'react';

import { PanelModel, PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';

import { AnnoListPanel } from './AnnoListPanel';
import { defaultOptions, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(AnnoListPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        category: ['Annotation query'],
        path: 'onlyFromThisDashboard',
        name: 'Query filter',
        defaultValue: defaultOptions.onlyFromThisDashboard,
        settings: {
          options: [
            { value: false, label: 'All dashboards' },
            { value: true, label: 'This dashboard' },
          ],
        },
      })
      .addRadio({
        category: ['Annotation query'],
        path: 'onlyInTimeRange',
        name: 'Time range',
        defaultValue: defaultOptions.onlyInTimeRange,
        settings: {
          options: [
            { value: false, label: 'None' },
            { value: true, label: 'This dashboard' },
          ],
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
        defaultValue: defaultOptions.limit,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showUser',
        name: 'Show user',
        defaultValue: defaultOptions.showUser,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showTime',
        name: 'Show time',
        defaultValue: defaultOptions.showTime,
      })
      .addBooleanSwitch({
        category: ['Display'],
        path: 'showTags',
        name: 'Show tags',
        defaultValue: defaultOptions.showTags,
      })
      .addRadio({
        category: ['Link behavior'],
        path: 'navigateToPanel',
        name: 'Link target',
        defaultValue: defaultOptions.navigateToPanel,
        settings: {
          options: [
            { value: true, label: 'Panel' },
            { value: false, label: 'Dashboard' },
          ],
        },
      })
      .addTextInput({
        category: ['Link behavior'],
        path: 'navigateBefore',
        name: 'Time before',
        defaultValue: defaultOptions.navigateBefore,
        description: '',
      })
      .addTextInput({
        category: ['Link behavior'],
        path: 'navigateAfter',
        name: 'Time after',
        defaultValue: defaultOptions.navigateAfter,
        description: '',
      });
  })
  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((panel: PanelModel<Options>, prevPluginId: string, prevOptions: unknown) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions as Options;
    }

    return panel.options;
  });
