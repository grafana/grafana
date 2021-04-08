import React, { useMemo, useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin, SelectableValue } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, RadioButtonGroup, useStyles } from '@grafana/ui';
import { getPanelFrameCategory } from './getPanelFrameOptions';
import { getVizualizationOptions } from './getVizualizationOptions';
import { css } from '@emotion/css';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { getFieldOverrideCategories } from './getFieldOverrideElements';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionSearchEngine } from './state/OptionSearchEngine';
import { AngularPanelOptions } from './AngularPanelOptions';
import { getRecentOptions } from './state/getRecentOptions';
interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  dashboard: DashboardModel;
  data?: PanelData;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}

export const OptionsPaneOptions: React.FC<Props> = (props) => {
  const { plugin, dashboard, panel } = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState(OptionFilter.All);
  const styles = useStyles(getStyles);

  const [panelFrameOptions, vizOptions, justOverrides] = useMemo(
    () => [getPanelFrameCategory(props), getVizualizationOptions(props), getFieldOverrideCategories(props)],
    [props]
  );

  const mainBoxElements: React.ReactNode[] = [];
  const isSearching = searchQuery.length > 0;
  const optionRadioFilters = useMemo(getOptionRadioFilters, []);
  const allOptions = [panelFrameOptions, ...vizOptions];

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
        // Panel frame options first
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <div className={styles.formRow}>
          <FilterInput width={0} value={searchQuery} onChange={setSearchQuery} placeholder={'Search options'} />
        </div>
        {!isSearching && (
          <div className={styles.formRow}>
            <RadioButtonGroup options={optionRadioFilters} value={listMode} fullWidth onChange={setListMode} />
          </div>
        )}
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.mainBox}>{mainBoxElements}</div>
          {!isSearching && listMode === OptionFilter.All && (
            <div className={styles.overridesBox}>{justOverrides.map((override) => override.render())}</div>
          )}
        </CustomScrollbar>
      </div>
    </div>
  );
};

function getOptionRadioFilters(): Array<SelectableValue<OptionFilter>> {
  return [
    { label: OptionFilter.All, value: OptionFilter.All },
    { label: OptionFilter.Recent, value: OptionFilter.Recent },
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
        {optionHits.map((hit) => hit.render(true))}
      </OptionsPaneCategory>
      {overrideHits.map((override) => override.render(true))}
    </div>
  );
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
  formRow: css`
    margin-bottom: ${theme.spacing.sm};
  `,
  formBox: css`
    padding: ${theme.spacing.sm};
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    border-bottom: none;
  `,
  closeButton: css`
    margin-left: ${theme.spacing.sm};
  `,
  searchHits: css`
    padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.sm};
  `,
  scrollWrapper: css`
    flex-grow: 1;
    min-height: 0;
  `,
  searchNotice: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
    padding: ${theme.spacing.sm};
    text-align: center;
  `,
  mainBox: css`
    background: ${theme.colors.bg1};
    margin-bottom: ${theme.spacing.md};
    border: 1px solid ${theme.colors.border1};
    border-top: none;
  `,
  overridesBox: css`
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    margin-bottom: ${theme.spacing.md};
    flex-grow: 1;
  `,
});
