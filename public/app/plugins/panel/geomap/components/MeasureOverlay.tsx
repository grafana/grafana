import { css } from '@emotion/css';
import { Map } from 'ol';
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

interface Props {
  map: Map;
}

interface State {
  length?: boolean;
}

export class MeasureOverlay extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { length: true };
  }

  updateViewState = () => {
    const view = this.props.map.getView();
    console.log(view);
  };

  componentDidMount() {
    this.props.map.on('moveend', this.updateViewState);
    this.updateViewState();
  }

  render() {
    return <div className={this.style.infoWrap}>measurement tools go here</div>;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
