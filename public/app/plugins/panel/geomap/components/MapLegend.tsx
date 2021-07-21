import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
import { Observable, Unsubscribable } from 'rxjs';
import { SimpleLegend } from './SimpleLegend';

interface Props<T> {
  data: Observable<T>;
}

interface State<T> {
  data?: T;
}

export class MapLegend<T = any> extends PureComponent<Props<T>, State<T>> {
  style = getStyles(config.theme);
  subscription?: Unsubscribable;
  constructor(props: Props<T>) {
    super(props);
    this.state = {};
  }
  componentDidMount() {
    this.subscription = this.props.data.subscribe({
      next: (data: T) => {
        this.setState({ data });
      },
    });
  }
  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  render() {
    return <SimpleLegend {...this.state.data} />;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
  legend: css`
    line-height: 18px;
    color: #555;
    display: flex;
    flex-direction: column;

    i {
      width: 18px;
      height: 18px;
      float: left;
      margin-right: 8px;
      opacity: 0.7;
    }
  `,
  legendItem: css`
    white-space: nowrap;
  `,
}));
