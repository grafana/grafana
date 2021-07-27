// Libraries
import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import { css, cx } from '@emotion/css';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  html: string;
}

export class CanvasPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { html } = this.state;
    const styles = getStyles();
    return <div>HELLO</div>;
  }
}

const getStyles = stylesFactory(() => {
  return {
    content: css`
      height: 100%;
    `,
  };
});
