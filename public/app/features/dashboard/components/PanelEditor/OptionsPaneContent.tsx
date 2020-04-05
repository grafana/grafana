import React, { useCallback, useState, CSSProperties } from 'react';
import Transition from 'react-transition-group/Transition';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import {
  CustomScrollbar,
  stylesFactory,
  Tab,
  TabContent,
  TabsBar,
  useTheme,
  Container,
  Icon,
  Input,
} from '@grafana/ui';
import { DefaultFieldConfigEditor, OverrideFieldConfigEditor } from './FieldConfigEditor';
import { AngularPanelOptions } from './AngularPanelOptions';
import { css } from 'emotion';
import { GeneralPanelOptions } from './GeneralPanelOptions';
import { PanelOptionsEditor } from './PanelOptionsEditor';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

export const OptionsPaneContent: React.FC<{
  plugin?: PanelPlugin;
  panel: PanelModel;
  data: PanelData;
  dashboard: DashboardModel;
  onClose: () => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}> = ({
  plugin,
  panel,
  data,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  onClose,
  dashboard,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [activeTab, setActiveTab] = useState('defaults');
  const [isSearching, setSearchMode] = useState(false);

  const renderFieldOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig) {
        return null;
      }

      return (
        <Container padding="md">
          {renderCustomPanelSettings(plugin)}
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

  const renderCustomPanelSettings = useCallback(
    (plugin: PanelPlugin) => {
      const editors: JSX.Element[] = [];
      if (plugin.editor && panel) {
        editors.push(
          <div className={styles.legacyOptions} key="plugin custom panel settings">
            <plugin.editor
              data={data}
              options={panel.getOptions()}
              onOptionsChange={onPanelOptionsChanged}
              fieldConfig={panel.getFieldConfig()}
              onFieldConfigChange={onFieldConfigsChange}
            />
          </div>
        );
      }

      // When editor created declaratively
      if (plugin.optionEditors && panel) {
        editors.push(
          <PanelOptionsEditor
            key="panel options"
            options={panel.getOptions()}
            onChange={onPanelOptionsChanged}
            plugin={plugin}
          />
        );
      }

      if (editors.length > 0) {
        return editors;
      }

      return (
        <div className={styles.legacyOptions}>
          <AngularPanelOptions panel={panel} dashboard={dashboard} plugin={plugin} />
        </div>
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderSearchInput = useCallback(() => {
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
  }, []);

  return (
    <div className={styles.panelOptionsPane}>
      {plugin && (
        <div className={styles.wrapper}>
          <TabsBar className={styles.tabsBar}>
            {isSearching && renderSearchInput()}
            {!isSearching && (
              <>
                <Tab label="Options" active={activeTab === 'defaults'} onChangeTab={() => setActiveTab('defaults')} />
                <Tab
                  label="Overrides"
                  active={activeTab === 'overrides'}
                  onChangeTab={() => setActiveTab('overrides')}
                />
                <Tab label="General" active={activeTab === 'panel'} onChangeTab={() => setActiveTab('panel')} />
                <div className="flex-grow-1" />
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
            )}
          </TabsBar>
          <TabContent className={styles.tabContent}>
            <CustomScrollbar>
              {activeTab === 'defaults' && renderFieldOptions(plugin)}
              {activeTab === 'overrides' && renderFieldOverrideOptions(plugin)}
              {activeTab === 'panel' && <GeneralPanelOptions panel={panel} onPanelConfigChange={onPanelConfigChange} />}
            </CustomScrollbar>
          </TabContent>
        </div>
      )}
    </div>
  );
};

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
