// Libraries
import React, { PureComponent } from 'react';
import { css } from 'emotion';

// Utils & Services
import { GrafanaTheme, PanelPlugin } from '@grafana/data';
import { stylesFactory, CustomScrollbar, styleMixins } from '@grafana/ui';
import config from 'app/core/config';

// Types
import { PanelProps } from '@grafana/data';

export interface Props extends PanelProps {}

export class GrafanaLinksPanel extends PureComponent<Props> {
  render() {
    return <h2>hello</h2>;
  }
}

export const plugin = new PanelPlugin(GrafanaLinksPanel).setDefaults({});
