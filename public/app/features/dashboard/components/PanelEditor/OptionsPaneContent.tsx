import React, { useCallback, useState, CSSProperties } from 'react';
import Transition from 'react-transition-group/Transition';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin, SelectableValue } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import {
  CustomScrollbar,
  stylesFactory,
  Tab,
  TabContent,
  TabsBar,
  Select,
  useTheme,
  Container,
  Icon,
  Input,
} from '@grafana/ui';
import { DefaultFieldConfigEditor, OverrideFieldConfigEditor } from './FieldConfigEditor';
import { css } from 'emotion';
import { PanelOptionsTab } from './PanelOptionsTab';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

export const OptionsPaneContent: React.FC<{
  plugin: PanelPlugin;
  panel: PanelModel;
  data: PanelData;
  width: number;
  dashboard: DashboardModel;
  onClose: () => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}> = ({
  plugin,
  panel,
  data,
  width,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  onClose,
  dashboard,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [activeTab, setActiveTab] = useState('options');
  const [isSearching, setSearchMode] = useState(false);

  const renderFieldOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig) {
        return null;
      }

      return (
        <Container padding="md">
          <DefaultFieldConfigEditor
            config={fieldConfig}
            plugin={plugin}
            onChange={onFieldConfigsChange}
            data={data.series}
            include={plugin.standardFieldConfigProperties}
          />
        </Container>
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderFieldOverrideOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig) {
        return null;
      }

      return (
        <OverrideFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          data={data.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  return (
    <div className={styles.panelOptionsPane}>
      {plugin && (
        <div className={styles.wrapper}>
          <TabsBar className={styles.tabsBar}>
            <TabsBarContent
              width={width}
              isSearching={isSearching}
              styles={styles}
              activeTab={activeTab}
              onClose={onClose}
              setSearchMode={setSearchMode}
              setActiveTab={setActiveTab}
            />
          </TabsBar>
          <TabContent className={styles.tabContent}>
            <CustomScrollbar>
              {activeTab === 'options' && (
                <PanelOptionsTab
                  panel={panel}
                  plugin={plugin}
                  dashboard={dashboard}
                  data={data}
                  onPanelConfigChange={onPanelConfigChange}
                  onFieldConfigsChange={onFieldConfigsChange}
                  onPanelOptionsChanged={onPanelOptionsChanged}
                />
              )}
              {activeTab === 'defaults' && renderFieldOptions(plugin)}
              {activeTab === 'overrides' && renderFieldOverrideOptions(plugin)}
            </CustomScrollbar>
          </TabContent>
        </div>
      )}
    </div>
  );
};

export const TabsBarContent: React.FC<{
  width: number;
  isSearching: boolean;
  activeTab: string;
  styles: OptionsPaneStyles;
  onClose: () => void;
  setSearchMode: (mode: boolean) => void;
  setActiveTab: (tab: string) => void;
}> = ({ width, isSearching, activeTab, onClose, setSearchMode, setActiveTab, styles }) => {
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
                    <Icon name="remove" onClick={() => setSearchMode(false)} className={styles.searchRemoveIcon} />
                  }
                />
              </div>
            </div>
          );
        }}
      </Transition>
    );
  }

  return (
    <>
      {width < 377 ? (
        <div className="flex-grow-1">
          <Select
            options={tabSelections}
            value={tabSelections.find(v => v.value === activeTab)}
            onChange={v => {
              setActiveTab(v.value);
            }}
          />
        </div>
      ) : (
        <>
          {tabSelections.map(item => {
            return (
              <Tab label={item.label} active={activeTab === item.value} onChangeTab={() => setActiveTab(item.value)} />
            );
          })}
          <div className="flex-grow-1" />
        </>
      )}

      <div className={styles.tabsButton}>
        <DashNavButton
          icon="fa fa-search"
          tooltip="Search all options"
          classSuffix="search-options"
          onClick={() => setSearchMode(true)}
        />
      </div>
      <div className={styles.tabsButton}>
        <DashNavButton
          icon="fa fa-chevron-right"
          tooltip="Close options pane"
          classSuffix="close-options"
          onClick={onClose}
        />
      </div>
    </>
  );
};

const tabSelections: Array<SelectableValue<string>> = [
  {
    label: 'Options',
    value: 'options',
  },
  {
    label: 'Fields',
    value: 'defaults',
  },
  {
    label: 'Overrides',
    value: 'overrides',
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
      background: ${theme.colors.pageBg};
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
