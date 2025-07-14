import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TagsInput } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { DashList } from './DashList';
import { dashlistMigrationHandler } from './migrations';
import { defaultOptions, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(DashList)
  .setPanelOptions((builder) => {
    const category = [t('dashlist.category-dashboard-list', 'Dashboard list')];
    builder
      .addBooleanSwitch({
        path: 'keepTime',
        name: t('dashlist.name-include-current-time-range', 'Include current time range'),
        category,
        defaultValue: defaultOptions.keepTime,
      })
      .addBooleanSwitch({
        path: 'includeVars',
        name: t('dashlist.name-include-current-template-variables', 'Include current template variable values'),
        category,
        defaultValue: defaultOptions.includeVars,
      })
      .addBooleanSwitch({
        path: 'showStarred',
        name: t('dashlist.name-starred', 'Starred'),
        category,
        defaultValue: defaultOptions.showStarred,
      })
      .addBooleanSwitch({
        path: 'showRecentlyViewed',
        name: t('dashlist.name-recently-viewed', 'Recently viewed'),
        category,
        defaultValue: defaultOptions.showRecentlyViewed,
      })
      .addBooleanSwitch({
        path: 'showSearch',
        name: t('dashlist.name-search', 'Search'),
        category,
        defaultValue: defaultOptions.showSearch,
      })
      .addBooleanSwitch({
        path: 'showHeadings',
        name: t('dashlist.name-show-headings', 'Show headings'),
        category,
        defaultValue: defaultOptions.showHeadings,
      })
      .addBooleanSwitch({
        path: 'showFolderNames',
        name: t('dashlist.name-show-folder-names', 'Show folder names'),
        category,
        defaultValue: defaultOptions.showFolderNames,
      })
      .addNumberInput({
        path: 'maxItems',
        name: t('dashlist.name-max-items', 'Max items'),
        category,
        defaultValue: defaultOptions.maxItems,
      })
      .addTextInput({
        path: 'query',
        name: t('dashlist.name-query', 'Query'),
        category,
        defaultValue: defaultOptions.query,
      })
      .addCustomEditor({
        path: 'folderUID',
        name: t('dashlist.name-folder', 'Folder'),
        category,
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
        name: t('dashlist.name-tags', 'Tags'),
        category,
        description: '',
        defaultValue: defaultOptions.tags,
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      });
  })
  .setMigrationHandler(dashlistMigrationHandler);
