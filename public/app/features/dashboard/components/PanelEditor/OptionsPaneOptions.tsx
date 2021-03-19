import React, { useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Field, RadioButtonGroup, useStyles } from '@grafana/ui';
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

  const radioOptions = [
    { label: 'All', value: 'all' },
    { label: 'Recent', value: 'popular' },
    { label: 'Overrides', value: 'overrides' },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.formBox}>
        <Field className={styles.customFieldMargin}>
          <FilterInput width={0} value={searchString} onChange={setSearchString} placeholder={'Search options'} />
        </Field>
        <Field className={styles.customFieldMargin}>
          <RadioButtonGroup options={radioOptions} value="all" fullWidth />
        </Field>
      </div>
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.optionsBox}>
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
        </div>
      </CustomScrollbar>
    </div>
  );
};

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
