import React, { CSSProperties, useCallback, useState } from 'react';
import Transition from 'react-transition-group/Transition';
import { FieldConfigSource, GrafanaTheme, PanelPlugin, SelectableValue } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Icon, Input, Select, stylesFactory, Tab, TabContent, TabsBar, useTheme } from '@grafana/ui';
import { DefaultFieldConfigEditor, OverrideFieldConfigEditor } from './FieldConfigEditor';
import { css } from 'emotion';
import { PanelOptionsTab } from './PanelOptionsTab';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { usePanelLatestData } from './usePanelLatestData';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  width: number;
  dashboard: DashboardModel;
  onClose: () => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}

export const OptionsPaneContent: React.FC<Props> = ({
  plugin,
  panel,
  width,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  onClose,
  dashboard,
}: Props) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [activeTab, setActiveTab] = useState('options');
  const [isSearching, setSearchMode] = useState(false);
  const { data, hasSeries } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false });

  const renderFieldOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig || !hasSeries) {
        return null;
      }

      return (
        <DefaultFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          /* hasSeries makes sure current data is there */
          data={data!.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderFieldOverrideOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig || !hasSeries) {
        return null;
      }

      return (
        <OverrideFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          /* hasSeries makes sure current data is there */
          data={data!.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  // When the panel has no query only show the main tab
  const showMainTab = activeTab === 'options' || plugin.meta.skipDataQuery;

  return (
    <div className={styles.panelOptionsPane} aria-label={selectors.components.PanelEditor.OptionsPane.content}>
      {plugin && (
        <div className={styles.wrapper}>
          <TabsBar className={styles.tabsBar}>
            <TabsBarContent
              width={width}
              plugin={plugin}
              isSearching={isSearching}
              styles={styles}
              activeTab={activeTab}
              onClose={onClose}
              setSearchMode={setSearchMode}
              setActiveTab={setActiveTab}
              panel={panel}
            />
          </TabsBar>
          <TabContent className={styles.tabContent}>
            <CustomScrollbar autoHeightMin="100%">
              {showMainTab ? (
                <PanelOptionsTab
                  panel={panel}
                  plugin={plugin}
                  dashboard={dashboard}
                  data={data}
                  onPanelConfigChange={onPanelConfigChange}
                  onPanelOptionsChanged={onPanelOptionsChanged}
                />
              ) : (
                <>
                  {activeTab === 'defaults' && renderFieldOptions(plugin)}
                  {activeTab === 'overrides' && renderFieldOverrideOptions(plugin)}
                </>
              )}
            </CustomScrollbar>
          </TabContent>
        </div>
      )}
    </div>
  );
};

export const TabsBarContent: React.FC<{
  width: number;
  plugin: PanelPlugin;
  isSearching: boolean;
  activeTab: string;
  styles: OptionsPaneStyles;
  onClose: () => void;
  setSearchMode: (mode: boolean) => void;
  setActiveTab: (tab: string) => void;
  panel: PanelModel;
}> = ({ width, plugin, isSearching, activeTab, onClose, setSearchMode, setActiveTab, styles, panel }) => {
  const overridesCount =
    panel.getFieldConfig().overrides.length === 0 ? undefined : panel.getFieldConfig().overrides.length;

  if (isSearching) {
    const defaultStyles = {
      transition: 'width 50ms ease-in-out',
      width: '50%',
      display: 'flex',
    };

    const transitionStyles: { [str: string]: CSSProperties } = {
      entered: { width: '100%' },
    };

    return (
      <Transition in={true} timeout={0} appear={true}>
        {state => {
          return (
            <div className={styles.searchWrapper}>
              <div style={{ ...defaultStyles, ...transitionStyles[state] }}>
                <Input
                  className={styles.searchInput}
                  type="text"
                  prefix={<Icon name="search" />}
                  ref={elem => elem && elem.focus()}
                  placeholder="Search all options"
                  suffix={
                    <Icon name="times" onClick={() => setSearchMode(false)} className={styles.searchRemoveIcon} />
                  }
                />
              </div>
            </div>
          );
        }}
      </Transition>
    );
  }

  // Show the appropriate tabs
  let tabs = tabSelections;
  let active = tabs.find(v => v.value === activeTab);

  // If no field configs hide Fields & Override tab
  if (plugin.fieldConfigRegistry.isEmpty()) {
    active = tabSelections[0];
    tabs = [active];
  }

  return (
    <>
      {width < 352 ? (
        <div className="flex-grow-1" aria-label={selectors.components.PanelEditor.OptionsPane.select}>
          <Select
            options={tabs}
            value={active}
            onChange={v => {
              setActiveTab(v.value);
            }}
          />
        </div>
      ) : (
        <>
          {tabs.map(item => (
            <Tab
              key={item.value}
              label={item.label}
              counter={item.value === 'overrides' ? overridesCount : undefined}
              active={active.value === item.value}
              onChangeTab={() => setActiveTab(item.value)}
              title={item.tooltip}
              aria-label={selectors.components.PanelEditor.OptionsPane.tab(item.label)}
            />
          ))}
          <div className="flex-grow-1" />
        </>
      )}
      <div className={styles.tabsButton}>
        <DashNavButton
          icon="angle-right"
          tooltip="Close options pane"
          classSuffix="close-options"
          onClick={onClose}
          iconSize="lg"
        />
      </div>
    </>
  );
};

const tabSelections: Array<SelectableValue<string>> = [
  {
    label: 'Panel',
    value: 'options',
    tooltip: 'Configure panel display options',
  },
  {
    label: 'Field',
    value: 'defaults',
    tooltip: 'Configure field options',
  },
  {
    label: 'Overrides',
    value: 'overrides',
    tooltip: 'Configure field option overrides',
  },
];

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      padding-top: ${theme.spacing.md};
    `,
    panelOptionsPane: css`
      height: 100%;
      width: 100%;
    `,
    tabsBar: css`
      padding-right: ${theme.spacing.sm};
    `,
    searchWrapper: css`
      display: flex;
      flex-grow: 1;
      flex-direction: row-reverse;
    `,
    searchInput: css`
      color: ${theme.colors.textWeak};
      flex-grow: 1;
    `,
    searchRemoveIcon: css`
      cursor: pointer;
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      background: ${theme.colors.bodyBg};
      border-left: 1px solid ${theme.colors.pageHeaderBorder};
    `,
    tabsButton: css``,
    legacyOptions: css`
      label: legacy-options;
      .panel-options-grid {
        display: flex;
        flex-direction: column;
      }
      .panel-options-group {
        margin-bottom: 0;
      }
      .panel-options-group__body {
        padding: ${theme.spacing.md} 0;
      }

      .section {
        display: block;
        margin: ${theme.spacing.md} 0;

        &:first-child {
          margin-top: 0;
        }
      }
    `,
  };
});

type OptionsPaneStyles = ReturnType<typeof getStyles>;
