import React, { useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { Field, useStyles } from '@grafana/ui';
import { usePanelLatestData } from './usePanelLatestData';
import { OptionPaneRenderProps, OptionsPaneGroup } from './types';
import { getPanelFrameOptions } from './getPanelFrameOptions';
import { OptionsGroup } from './OptionsGroup';
import { getFieldOverrides, getVizualizationOptions } from './getVizualizationOptions';
import { css } from 'emotion';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

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
  const [searchString, setSearchString] = useState('');
  const styles = useStyles(getStyles);
  const topGroups: OptionsPaneGroup[] = [];
  const optionProps: OptionPaneRenderProps = {
    panel,
    onPanelOptionsChanged,
    onPanelConfigChange,
    onFieldConfigsChange,
    plugin,
    data,
    eventBus: dashboard.events,
  };

  topGroups.push(getPanelFrameOptions(optionProps));
  topGroups.push(...getVizualizationOptions(optionProps));
  topGroups.push(...getFieldOverrides(optionProps));

  return (
    <>
      <div className={styles.searchBox}>
        <FilterInput width={0} value={searchString} onChange={setSearchString} placeholder={'Search options'} />
      </div>
      {topGroups.map((topGroup) => (
        <OptionsGroup key={topGroup.title} title={topGroup.title} id={topGroup.title}>
          {topGroup.items?.map((child1) => (
            <Field label={child1.title} description={child1.description} key={child1.title}>
              {child1.reactNode!}
            </Field>
          ))}
          {topGroup.groups?.map((childGroup) => (
            <OptionsGroup id={childGroup.title} key={childGroup.title} title={childGroup.title} defaultToClosed>
              {childGroup.items?.map((child2) => (
                <Field label={child2.title} description={child2.description} key={child2.title}>
                  {child2.reactNode!}
                </Field>
              ))}
            </OptionsGroup>
          ))}
        </OptionsGroup>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    searchBox: css`
      padding: ${theme.spacing.sm};
      display: flex;
      flex-direction: column;
      min-height: 0;
    `,
  };
};
