import React, { useMemo, useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Field, RadioButtonGroup, useStyles } from '@grafana/ui';
import { getPanelFrameCategory } from './getPanelFrameOptions';
import { getVizualizationOptions } from './getVizualizationOptions';
import { css } from 'emotion';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { getFieldOverrideCategories } from './getFieldOverrideElements';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionSearchEngine } from './state/OptionSearchEngine';
import { AngularPanelOptions } from './AngularPanelOptions';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState('all');
  const styles = useStyles(getStyles);
  const { plugin, dashboard, panel } = props;

  const [panelFrameOptions, vizOptions, justOverrides] = useMemo(
    () => [getPanelFrameCategory(props), getVizualizationOptions(props), getFieldOverrideCategories(props)],
    [props]
  );

  const radioOptions = [
    { label: 'All', value: 'all' },
    { label: 'Popular', value: 'popular' },
    { label: `Overrides`, value: 'overrides' },
  ];

  const mainBoxElements: React.ReactNode[] = [];
  const isSearching = searchQuery.length > 0;

  if (isSearching) {
    const allOptions = [panelFrameOptions, ...vizOptions];
    mainBoxElements.push(renderSearchHits(allOptions, justOverrides, searchQuery));

    // If searching for angular panel then we need to add notice that results are limited
    if (props.plugin.angularPanelCtrl) {
      mainBoxElements.push(
        <div className={styles.searchNotice} key="Search notice">
          This is an old visualization type that does not support searching all options.
        </div>
      );
    }
  } else {
    switch (listMode) {
      case 'all':
        // Panel frame options first
        mainBoxElements.push(panelFrameOptions.render());
        // If angular add those options next
        if (props.plugin.angularPanelCtrl) {
          mainBoxElements.push(
            <AngularPanelOptions plugin={plugin} dashboard={dashboard} panel={panel} key="AngularOptions" />
          );
        }
        // Then add all panel & field defaults
        for (const item of vizOptions) {
          mainBoxElements.push(item.render());
        }
        break;
      case 'overrides':
        for (const override of justOverrides) {
          mainBoxElements.push(override.render());
        }
        break;
      case 'popular':
        mainBoxElements.push(
          <OptionsPaneCategory id="Popular options" title="Popular options" key="Popular options">
            No poular options, try again later
          </OptionsPaneCategory>
        );
        break;
    }
  }

  const showOverridesInSeparateBox = !isSearching && listMode === 'all';

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <Field className={styles.customFieldMargin}>
          <FilterInput width={0} value={searchQuery} onChange={setSearchQuery} placeholder={'Search options'} />
        </Field>
        {!isSearching && (
          <Field className={styles.noFieldMargin}>
            <RadioButtonGroup options={radioOptions} value={listMode} fullWidth onChange={setListMode} />
          </Field>
        )}
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.mainBox}>{mainBoxElements}</div>
          {showOverridesInSeparateBox && (
            <div className={styles.overridesBox}>{justOverrides.map((override) => override.render())}</div>
          )}
        </CustomScrollbar>
      </div>
    </div>
  );
};

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
  searchNotice: css`
    text-align: center;
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
    padding: ${theme.spacing.sm};
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
