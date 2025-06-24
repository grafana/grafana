import { PanelModel, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TagsInput } from '@grafana/ui';

import { AnnoListPanel } from './AnnoListPanel';
import { defaultOptions, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(AnnoListPanel)
  .setPanelOptions((builder) => {
    const category = [t('annolist.category-annotation-query', 'Annotation query')];
    const displayCategory = [t('annolist.category-display', 'Display')];
    const linkBehaviourCategory = [t('annolist.category-link-behaviour', 'Link behavior')];
    builder
      .addRadio({
        category,
        path: 'onlyFromThisDashboard',
        name: t('annolist.name-query-filter', 'Query filter'),
        defaultValue: defaultOptions.onlyFromThisDashboard,
        settings: {
          options: [
            { value: false, label: t('annolist.query-filter-options.label-all-dashboards', 'All dashboards') },
            { value: true, label: t('annolist.query-filter-options.label-this-dashboard', 'This dashboard') },
          ],
        },
      })
      .addRadio({
        category,
        path: 'onlyInTimeRange',
        name: t('annolist.name-time-range', 'Time range'),
        defaultValue: defaultOptions.onlyInTimeRange,
        settings: {
          options: [
            { value: false, label: t('annolist.time-range-options.label-none', 'None') },
            { value: true, label: t('annolist.time-range-options.label-this-dashboard', 'This dashboard') },
          ],
        },
      })
      .addCustomEditor({
        category,
        id: 'tags',
        path: 'tags',
        name: t('annolist.name-tags', 'Tags'),
        description: t('annolist.description-tags', 'Match annotation tags'),
        editor(props) {
          return <TagsInput tags={props.value} onChange={props.onChange} />;
        },
      })
      .addNumberInput({
        category,
        path: 'limit',
        name: t('annolist.name-limit', 'Limit'),
        defaultValue: defaultOptions.limit,
      })
      .addBooleanSwitch({
        category: displayCategory,
        path: 'showUser',
        name: t('annolist.name-show-user', 'Show user'),
        defaultValue: defaultOptions.showUser,
      })
      .addBooleanSwitch({
        category: displayCategory,
        path: 'showTime',
        name: t('annolist.name-show-time', 'Show time'),
        defaultValue: defaultOptions.showTime,
      })
      .addBooleanSwitch({
        category: displayCategory,
        path: 'showTags',
        name: t('annolist.name-show-tags', 'Show tags'),
        defaultValue: defaultOptions.showTags,
      })
      .addRadio({
        category: linkBehaviourCategory,
        path: 'navigateToPanel',
        name: t('annolist.name-link-target', 'Link target'),
        defaultValue: defaultOptions.navigateToPanel,
        settings: {
          options: [
            { value: true, label: t('annolist.link-target-options.label-panel', 'Panel') },
            { value: false, label: t('annolist.link-target-options.label-dashboard', 'Dashboard') },
          ],
        },
      })
      .addTextInput({
        category: linkBehaviourCategory,
        path: 'navigateBefore',
        name: t('annolist.name-time-before', 'Time before'),
        defaultValue: defaultOptions.navigateBefore,
        description: '',
      })
      .addTextInput({
        category: linkBehaviourCategory,
        path: 'navigateAfter',
        name: t('annolist.name-time-after', 'Time after'),
        defaultValue: defaultOptions.navigateAfter,
        description: '',
      });
  })
  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((panel: PanelModel<Options>, prevPluginId, prevOptions) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions;
    }

    return panel.options;
  });
