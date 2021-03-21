import React, { useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Field, RadioButtonGroup, useStyles } from '@grafana/ui';
import { usePanelLatestData } from './usePanelLatestData';
import { OptionPaneRenderProps } from './types';
import { getPanelFrameCategory } from './getPanelFrameOptions';
import { getVizualizationOptions } from './getVizualizationOptions';
import { css } from 'emotion';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { getFieldOverrideCategories } from './getFieldOverrideElements';
import { OptionsPaneCategoryDescriptor, OptionsPaneItemDescriptor } from './OptionsPaneItems';

interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  dashboard: DashboardModel;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}

export const OptionsPaneOptions: React.FC<Props> = ({
  plugin,
  panel,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  dashboard,
}: Props) => {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState('all');
  const searchRegex = new RegExp(searchQuery, 'i');
  const styles = useStyles(getStyles);

  const optionProps: OptionPaneRenderProps = {
    panel,
    onPanelOptionsChanged,
    onPanelConfigChange,
    onFieldConfigsChange,
    plugin,
    data,
    eventBus: dashboard.events,
  };

  const callCategories = [getPanelFrameCategory(optionProps), ...getVizualizationOptions(optionProps)];
  const justOverrides = getFieldOverrideCategories(optionProps);
  const allOptions = callCategories;

  const radioOptions = [
    { label: 'All', value: 'all' },
    { label: 'Popular', value: 'popular' },
    { label: `Overrides`, value: 'overrides' },
  ];

  const isSearching = searchQuery.length > 0;
  const showAllDefaults = !isSearching && listMode === 'all';
  const showOverridesInSeparateBox = !isSearching && listMode === 'all';
  const showOnlyOverrides = !isSearching && listMode === 'overrides';
  const showPopular = listMode === 'popular';

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <Field className={styles.customFieldMargin}>
          <FilterInput width={0} value={searchQuery} onChange={setSearchQuery} placeholder={'Search options'} />
        </Field>
        <Field className={styles.noFieldMargin}>
          <RadioButtonGroup options={radioOptions} value={listMode} fullWidth onChange={setListMode} />
        </Field>
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.mainBox}>
            {showAllDefaults && callCategories.map((callCategories) => callCategories.render())}
            {showOnlyOverrides && justOverrides.map((override) => override.render())}
            {showPopular && (
              <OptionsPaneCategory id="Popular options" title="Popular options">
                No poular options, try again later
              </OptionsPaneCategory>
            )}
            {isSearching && (
              <OptionsPaneCategory id="Found options" title="Found options">
                {getSearchHits(allOptions, searchRegex).map((hit) => hit.render())}
              </OptionsPaneCategory>
            )}
          </div>
          {showOverridesInSeparateBox && (
            <div className={styles.overridesBox}>{justOverrides.map((override) => override.render())}</div>
          )}
        </CustomScrollbar>
      </div>
    </div>
  );
};

function getSearchHits(categories: OptionsPaneCategoryDescriptor[], searchRegex: RegExp) {
  const filteredItems: OptionsPaneItemDescriptor[] = [];

  for (const category of categories) {
    for (const item of category.items) {
      if (searchRegex.test(item.props.title)) {
        filteredItems.push(item);
      }
    }
    if (category.categories.length > 0) {
      filteredItems.push(...getSearchHits(category.categories, searchRegex));
    }
  }

  return filteredItems;
}

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
  `,
  searchBox: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  customFieldMargin: css`
    margin-bottom: ${theme.spacing.sm};
  `,
  noFieldMargin: css`
    margin-bottom: 0;
  `,
  formBox: css`
    padding: ${theme.spacing.sm};
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    border-bottom: 0;
  `,
  searchHits: css`
    padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.sm};
  `,
  scrollWrapper: css`
    flex-grow: 1;
    min-height: 0;
  `,
  mainBox: css`
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    border-top: none;
    margin-bottom: ${theme.spacing.md};
  `,
  overridesBox: css`
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    margin-bottom: ${theme.spacing.md};
  `,
});
