// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { CustomScrollbar, stylesFactory } from '@grafana/ui';

// Types
import { PanelProps, GrafanaTheme, LiveChannelStatusEvent, LiveChannelMessageEvent } from '@grafana/data';
import { LivePanelOptions } from './types';
import { css } from 'emotion';

interface Props extends PanelProps<LivePanelOptions> {}

interface State {
  hasLive?: boolean;
  status?: LiveChannelStatusEvent;
  message?: LiveChannelMessageEvent<any>;
}

export class LivePanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  componentDidMount(): void {
    this.loadFeed();
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options?.channel !== prevProps.options?.channel) {
      this.loadFeed();
    }
  }

  async loadFeed() {
    const { options } = this.props;
    console.log('TODO... connect', options);
  }

  render() {
    // const styles = getStyles(config.theme);

    // if (isError) {
    //   return <div>Error Loading News</div>;
    // }
    // if (!news) {
    //   return <div>loading...</div>;
    // }

    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        TODO!!!!!!
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  container: css`
    height: 100%;
  `,
  item: css`
    padding: ${theme.spacing.sm};
    position: relative;
    margin-bottom: 4px;
    margin-right: ${theme.spacing.sm};
    border-bottom: 2px solid ${theme.colors.border1};
  `,
  title: css`
    color: ${theme.colors.linkExternal};
    max-width: calc(100% - 70px);
    font-size: 16px;
    margin-bottom: ${theme.spacing.sm};
  `,
  content: css`
    p {
      margin-bottom: 4px;
      color: ${theme.colors.text};
    }
  `,
  date: css`
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.colors.panelBg};
    width: 55px;
    text-align: right;
    padding: ${theme.spacing.xs};
    font-weight: 500;
    border-radius: 0 0 0 3px;
    color: ${theme.colors.textWeak};
  `,
}));
