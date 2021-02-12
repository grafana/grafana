import _ from 'lodash';
import { PanelModel, PanelPlugin } from '@grafana/data';
import { DashList } from './DashList';
import { DashListOptions } from './types';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import React from 'react';
import { TagsInput } from '@grafana/ui';

export const plugin = new PanelPlugin<DashListOptions>(DashList)
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'showStarred',
        name: 'Starred',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showRecentlyViewed',
        name: 'Recently viewed',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'showSearch',
        name: 'Search',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'showHeadings',
        name: 'Show headings',
        defaultValue: true,
      })
      .addNumberInput({
        path: 'maxItems',
        name: 'Max items',
        defaultValue: 10,
      })
      .addTextInput({
        path: 'query',
        name: 'Query',
        defaultValue: '',
      })
      .addCustomEditor({
        path: 'folderId',
        name: 'Folder',
        id: 'folderId',
        defaultValue: null,
        editor: function RenderFolderPicker(props) {
          return (
            <FolderPicker
              initialFolderId={props.value}
              useNewForms
              initialTitle="All"
              enableReset={true}
              onChange={({ id }) => props.onChange(id)}
            />
          );
        },
      })
      .addCustomEditor({
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: '',
        defaultValue: [],
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      });
  })
  .setMigrationHandler((panel: PanelModel<DashListOptions> & Record<string, any>) => {
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
