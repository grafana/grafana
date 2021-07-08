import React, { Component } from 'react';
import { Map } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  map: Map;
}

export class GeomapOverlay extends Component<Props> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div className={this.style.overlay}>
        <div className={this.style.TR}>TOP RIGHT</div>
        <div className={this.style.BL}>Bottom Left</div>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  overlay: css`
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 500;
    pointer-events: none;
  `,
  TR: css`
    position: absolute;
    border: 1px solid green;
    top: 8px;
    right: 8px;
    pointer-events: auto;
  `,
  BL: css`
    position: absolute;
    border: 1px solid green;
    bottom: 8px;
    left: 8px;
    pointer-events: auto;
  `,
}));
