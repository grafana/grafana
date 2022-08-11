import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { CustomScrollbar, FilterInput, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';

import { AngularPanelOptions } from './AngularPanelOptions';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { getFieldOverrideCategories } from './getFieldOverrideElements';
import { getLibraryPanelOptionsCategory } from './getLibraryPanelOptions';
import { getPanelFrameCategory } from './getPanelFrameOptions';
import { getVisualizationOptions } from './getVisualizationOptions';
import { OptionSearchEngine } from './state/OptionSearchEngine';
import { getRecentOptions } from './state/getRecentOptions';
import { OptionPaneRenderProps } from './types';

export const OptionsPaneOptions: React.FC<OptionPaneRenderProps> = (props) => {
  const { plugin, dashboard, panel } = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState(OptionFilter.All);
  const styles = useStyles2(getStyles);

  const [panelFrameOptions, vizOptions, libraryPanelOptions] = useMemo(
    () => [getPanelFrameCategory(props), getVisualizationOptions(props), getLibraryPanelOptionsCategory(props)],

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.configRev, props.data, props.instanceState, searchQuery]
  );

  const justOverrides = useMemo(
    () => getFieldOverrideCategories(props, searchQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.configRev, props.data, props.instanceState, searchQuery]
  );

  const mainBoxElements: React.ReactNode[] = [];
  const isSearching = searchQuery.length > 0;
  const optionRadioFilters = useMemo(getOptionRadioFilters, []);

  const allOptions = isPanelModelLibraryPanel(panel)
    ? [libraryPanelOptions, panelFrameOptions, ...vizOptions]
    : [panelFrameOptions, ...vizOptions];

  if (isSearching) {
    mainBoxElements.push(renderSearchHits(allOptions, justOverrides, searchQuery));

    // If searching for angular panel, then we need to add notice that results are limited
    if (props.plugin.angularPanelCtrl) {
      mainBoxElements.push(
        <div className={styles.searchNotice} key="Search notice">
          This is an old visualization type that does not support searching all options.
        </div>
      );
    }
  } else {
    switch (listMode) {
      case OptionFilter.All:
        if (isPanelModelLibraryPanel(panel)) {
          // Library Panel options first
          mainBoxElements.push(libraryPanelOptions.render());
        }
        // Panel frame options second
        mainBoxElements.push(panelFrameOptions.render());
        // If angular add those options next
        if (props.plugin.angularPanelCtrl) {
          mainBoxElements.push(
            <AngularPanelOptions plugin={plugin} dashboard={dashboard} panel={panel} key="AngularOptions" />
          );
        }
        // Then add all panel and field defaults
        for (const item of vizOptions) {
          mainBoxElements.push(item.render());
        }

        for (const item of justOverrides) {
          mainBoxElements.push(item.render());
        }
        break;
      case OptionFilter.Overrides:
        for (const override of justOverrides) {
          mainBoxElements.push(override.render());
        }
        break;
      case OptionFilter.Recent:
        mainBoxElements.push(
          <OptionsPaneCategory id="Recent options" title="Recent options" key="Recent options" forceOpen={1}>
            {getRecentOptions(allOptions).map((item) => item.render())}
          </OptionsPaneCategory>
        );
        break;
    }
  }

  // only show radio buttons if we are searching or if the plugin has field config
  const showSearchRadioButtons = !isSearching && !plugin.fieldConfigRegistry.isEmpty();

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <div className={styles.formRow}>
          <FilterInput width={0} value={searchQuery} onChange={setSearchQuery} placeholder={'Search options'} />
        </div>
        {showSearchRadioButtons && (
          <div className={styles.formRow}>
            <RadioButtonGroup options={optionRadioFilters} value={listMode} fullWidth onChange={setListMode} />
          </div>
        )}
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.mainBox}>{mainBoxElements}</div>
        </CustomScrollbar>
      </div>
    </div>
  );
};

function getOptionRadioFilters(): Array<SelectableValue<OptionFilter>> {
  return [
    { label: OptionFilter.All, value: OptionFilter.All },
    { label: OptionFilter.Overrides, value: OptionFilter.Overrides },
  ];
}

export enum OptionFilter {
  All = 'All',
  Overrides = 'Overrides',
  Recent = 'Recent',
}

function renderSearchHits(
  allOptions: OptionsPaneCategoryDescriptor[],
  overrides: OptionsPaneCategoryDescriptor[],
  searchQuery: string
) {
  const engine = new OptionSearchEngine(allOptions, overrides);
  const { optionHits, totalCount, overrideHits } = engine.search(searchQuery);

  return (
    <div key="search results">
      <OptionsPaneCategory
        id="Found options"
        title={`Matched ${optionHits.length}/${totalCount} options`}
        key="Normal options"
        forceOpen={1}
      >
        {optionHits.map((hit) => hit.render(searchQuery))}
      </OptionsPaneCategory>
      {overrideHits.map((override) => override.render(searchQuery))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;

    .search-fragment-highlight {
      color: ${theme.colors.warning.text};
      background: transparent;
    }
  `,
  searchBox: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  formRow: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  formBox: css`
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.components.panel.borderColor};
    border-top-left-radius: ${theme.shape.borderRadius(1.5)};
    border-bottom: none;
  `,
  closeButton: css`
    margin-left: ${theme.spacing(1)};
  `,
  searchHits: css`
    padding: ${theme.spacing(1, 1, 0, 1)};
  `,
  scrollWrapper: css`
    flex-grow: 1;
    min-height: 0;
  `,
  searchNotice: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(1)};
    text-align: center;
  `,
  mainBox: css`
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.components.panel.borderColor};
    border-top: none;
    flex-grow: 1;
  `,
});
