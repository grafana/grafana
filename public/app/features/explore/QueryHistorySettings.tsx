import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { stylesFactory } from '@grafana/ui';

interface QueryHistorySettingsProps {}

interface QueryHistorySettingsState {}

const getStyles = stylesFactory(() => {
  return {
    drawer: css`
      position: fixed;
      bottom: 0;
      height: 40%;
      width: 100%;
      background-color: white;
      border: solid 1px #dde4ed;
      padding-left: 10px;
      padding-top: 3px;
    `,
  };
});

export class QueryHistorySettings extends PureComponent<QueryHistorySettingsProps, QueryHistorySettingsState> {
  constructor(props: QueryHistorySettingsProps) {
    super(props);
    this.state = {};
  }

  render() {
    const styles = getStyles();
    return <div>Test</div>;
  }
}
