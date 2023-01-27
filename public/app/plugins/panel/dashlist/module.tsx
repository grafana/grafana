import React from 'react';

import { PanelModel, PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TagsInput } from '@grafana/ui';

import {
  ALL_FOLDER,
  GENERAL_FOLDER,
  ReadonlyFolderPicker,
} from '../../../core/components/Select/ReadonlyFolderPicker/ReadonlyFolderPicker';

import { DashList } from './DashList';
import { defaultPanelOptions, PanelLayout, PanelOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<PanelOptions>(DashList)
  .setPanelOptions((builder) => {
    if (config.featureToggles.dashboardPreviews) {
      builder.addRadio({
        path: 'layout',
        name: 'Layout',
        defaultValue: PanelLayout.List,
        settings: {
          options: [
            { value: PanelLayout.List, label: 'List' },
            { value: PanelLayout.Previews, label: 'Preview' },
          ],
        },
      });
    }

    builder
      .addBooleanSwitch({
        path: 'showStarred',
        name: 'Starred',
        defaultValue: defaultPanelOptions.showStarred,
      })
      .addBooleanSwitch({
        path: 'showRecentlyViewed',
        name: 'Recently viewed',
        defaultValue: defaultPanelOptions.showRecentlyViewed,
      })
      .addBooleanSwitch({
        path: 'showSearch',
        name: 'Search',
        defaultValue: defaultPanelOptions.showSearch,
      })
      .addBooleanSwitch({
        path: 'showHeadings',
        name: 'Show headings',
        defaultValue: defaultPanelOptions.showHeadings,
      })
      .addNumberInput({
        path: 'maxItems',
        name: 'Max items',
        defaultValue: defaultPanelOptions.maxItems,
      })
      .addTextInput({
        path: 'query',
        name: 'Query',
        defaultValue: defaultPanelOptions.query,
      })
      .addCustomEditor({
        path: 'folderId',
        name: 'Folder',
        id: 'folderId',
        defaultValue: undefined,
        editor: function RenderFolderPicker({ value, onChange }) {
          return (
            <ReadonlyFolderPicker
              initialFolderId={value}
              onChange={(folder) => onChange(folder?.id)}
              extraFolders={[ALL_FOLDER, GENERAL_FOLDER]}
            />
          );
        },
      })
      .addCustomEditor({
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: '',
        defaultValue: defaultPanelOptions.tags,
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      });
  })
  .setMigrationHandler((panel: PanelModel<PanelOptions> & Record<string, any>) => {
    const newOptions = {
      showStarred: panel.options.showStarred ?? panel.starred,
      showRecentlyViewed: panel.options.showRecentlyViewed ?? panel.recent,
      showSearch: panel.options.showSearch ?? panel.search,
      showHeadings: panel.options.showHeadings ?? panel.headings,
      maxItems: panel.options.maxItems ?? panel.limit,
      query: panel.options.query ?? panel.query,
      folderId: panel.options.folderId ?? panel.folderId,
      tags: panel.options.tags ?? panel.tags,
    };

    const previousVersion = parseFloat(panel.pluginVersion || '6.1');
    if (previousVersion < 6.3) {
      const oldProps = ['starred', 'recent', 'search', 'headings', 'limit', 'query', 'folderId'];
      oldProps.forEach((prop) => delete panel[prop]);
    }

    return newOptions;
  });
