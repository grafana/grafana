import { PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { DashList } from './DashList';
import { dashlistMigrationHandler } from './migrations';
import { defaultOptions, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(DashList)
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'keepTime',
        name: 'Include current time range',
        defaultValue: defaultOptions.keepTime,
      })
      .addBooleanSwitch({
        path: 'includeVars',
        name: 'Include current template variable values',
        defaultValue: defaultOptions.includeVars,
      })
      .addBooleanSwitch({
        path: 'showStarred',
        name: 'Starred',
        defaultValue: defaultOptions.showStarred,
      })
      .addBooleanSwitch({
        path: 'showRecentlyViewed',
        name: 'Recently viewed',
        defaultValue: defaultOptions.showRecentlyViewed,
      })
      .addBooleanSwitch({
        path: 'showSearch',
        name: 'Search',
        defaultValue: defaultOptions.showSearch,
      })
      .addBooleanSwitch({
        path: 'showHeadings',
        name: 'Show headings',
        defaultValue: defaultOptions.showHeadings,
      })
      .addBooleanSwitch({
        path: 'showFolderNames',
        name: 'Show folder names',
        defaultValue: defaultOptions.showFolderNames,
      })
      .addNumberInput({
        path: 'maxItems',
        name: 'Max items',
        defaultValue: defaultOptions.maxItems,
      })
      .addTextInput({
        path: 'query',
        name: 'Query',
        defaultValue: defaultOptions.query,
      })
      .addCustomEditor({
        path: 'folderUID',
        name: 'Folder',
        id: 'folderUID',
        defaultValue: undefined,
        editor: function RenderFolderPicker({ value, onChange }) {
          return (
            <FolderPicker clearable permission="view" value={value} onChange={(folderUID) => onChange(folderUID)} />
          );
        },
      })
      .addCustomEditor({
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: '',
        defaultValue: defaultOptions.tags,
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      });
  })
  .setMigrationHandler(dashlistMigrationHandler);
