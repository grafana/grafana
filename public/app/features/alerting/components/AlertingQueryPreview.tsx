import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme, PanelData } from '@grafana/data';
import { TabsBar, TabContent, Tab, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { StoreState } from '../../../types';

enum Tabs {
  Query = 'query',
  Instance = 'instance',
}

const tabs = [
  { id: Tabs.Query, text: 'Query', active: true },
  { id: Tabs.Instance, text: 'Alerting instance', active: false },
];

interface OwnProps {}

interface ConnectedProps {
  data: PanelData[];
}

interface DispatchProps {}

type Props = ConnectedProps & DispatchProps & OwnProps;

interface State {
  activeTab: string;
}

export class AlertingQueryPreview extends PureComponent<Props, State> {
  state = {
    activeTab: 'query',
  };

  onChangeTab = (tab: string) => {
    this.setState({ activeTab: tab });
  };

  render() {
    const { activeTab } = this.state;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <TabsBar>
          {tabs.map((tab, index) => {
            return (
              <Tab
                key={`${tab.id}-${index}`}
                label={tab.text}
                onChangeTab={() => this.onChangeTab(tab.id)}
                active={activeTab === tab.id}
              />
            );
          })}
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {activeTab === Tabs.Query && <div>Query result</div>}
          {activeTab === Tabs.Instance && <div>Instance something something dark side</div>}
        </TabContent>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    data: state.alertDefinition.data,
  };
};

export default connect(mapStateToProps)(AlertingQueryPreview);

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const tabBarHeight = 42;

  return {
    wrapper: css`
      label: alertDefinitionPreviewTabs;
      width: 100%;
      height: 100%;
      padding: ${theme.spacing.md} 0 0 ${theme.spacing.md};
    `,
    tabContent: css`
      background: ${theme.colors.panelBg};
      height: calc(100% - ${tabBarHeight}px);
    `,
  };
});
