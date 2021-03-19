import React, { ReactElement, useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Field, RadioButtonGroup, useStyles } from '@grafana/ui';
import { usePanelLatestData } from './usePanelLatestData';
import { OptionPaneRenderProps } from './types';
import { getPanelFrameOptions } from './getPanelFrameOptions';
import { getFieldOverrides, getVizualizationOptions } from './getVizualizationOptions';
import { css } from 'emotion';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import {
  OptionsPaneCategory,
  OptionsPaneCategoryProps,
  OptionsPaneItem,
  OptionsPaneItemProps,
} from './OptionsPaneItems';
import { OptionsGroup } from './OptionsGroup';

interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  dashboard: DashboardModel;
  onClose: () => void;
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
  onClose,
  dashboard,
}: Props) => {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false });
  const [searchQuery, setSearchQuery] = useState('');
  const searchRegex = new RegExp(searchQuery, 'i');
  const styles = useStyles(getStyles);
  const groupElements: Array<ReactElement<OptionsPaneCategoryProps>> = [];
  const optionProps: OptionPaneRenderProps = {
    panel,
    onPanelOptionsChanged,
    onPanelConfigChange,
    onFieldConfigsChange,
    plugin,
    data,
    eventBus: dashboard.events,
  };

  groupElements.push(getPanelFrameOptions(optionProps));

  //topGroups.push(...getVizualizationOptions(optionProps));
  //topGroups.push(...getFieldOverrides(optionProps));

  const radioOptions = [
    { label: 'All', value: 'all' },
    { label: 'Recent', value: 'popular' },
    { label: 'Overrides', value: 'overrides' },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <Field className={styles.customFieldMargin}>
          <FilterInput width={0} value={searchQuery} onChange={setSearchQuery} placeholder={'Search options'} />
        </Field>
        <Field className={styles.customFieldMargin}>
          <RadioButtonGroup options={radioOptions} value="all" fullWidth />
        </Field>
      </div>
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.optionsBox}>
          {searchQuery.length === 0 && groupElements}
          {searchQuery.length > 0 && (
            <OptionsGroup id="Search results" title="Search results">
              {getSearchHits(groupElements, searchRegex)}
            </OptionsGroup>
          )}
        </div>
      </CustomScrollbar>
    </div>
  );
};

function getSearchHits(items: Array<ReactElement<OptionsPaneCategoryProps>>, searchRegex: RegExp) {
  const filteredItems: React.ReactElement[] = [];

  React.Children.forEach(items, (topGroup) => {
    React.Children.forEach(topGroup, (item) => {
      const displayName = (item.type as any).displayName;
      console.log('item', item);

      if (displayName === OptionsPaneItem.displayName) {
        const props = item.props as OptionsPaneItemProps;
        if (searchRegex.test(props.title)) {
          filteredItems.push(item);
        }
      } else if (displayName === OptionsPaneCategory.displayName) {
        filteredItems.push(...getSearchHits(item.props.children as any, searchRegex));
      }
    });
  });

  return filteredItems;
}

const getStyles = (theme: GrafanaTheme) => ({
  searchBox: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  customFieldMargin: css`
    margin-bottom: ${theme.spacing.sm};
  `,
  formBox: css`
    padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.sm};
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    margin-bottom: ${theme.spacing.md};
  `,
  searchHits: css`
    padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.sm};
  `,
  wrapper: css`
    flex-grow: 1;
    min-height: 0;
  `,
  optionsBox: css`
    min-height: 0;
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
  `,
});
