import _ from 'lodash';
import React, { Component } from 'react';

import { CloudWatchLogsQuery } from '../types';
import { PanelData } from '@grafana/data';
import { encodeUrl, AwsUrl } from '../aws_url';
import { CloudWatchDatasource } from '../datasource';

interface Props {
  query: CloudWatchLogsQuery;
  panelData: PanelData;
  datasource: CloudWatchDatasource;
}

interface State {
  href: string;
}

export default class CloudWatchLink extends Component<Props, State> {
  state: State = { href: '' };
  async componentDidUpdate(prevProps: Props) {
    if (prevProps.panelData !== this.props.panelData && this.props.panelData.request) {
      const href = this.getExternalLink();
      this.setState({ href });
    }
  }

  getExternalLink(): string {
    const { query, panelData, datasource } = this.props;

    const range = panelData?.request?.range;

    if (!range) {
      return '';
    }

    const start = range.from.toISOString();
    const end = range.to.toISOString();

    const urlProps: AwsUrl = {
      end,
      start,
      timeType: 'ABSOLUTE',
      tz: 'UTC',
      editorString: query.expression ?? '',
      isLiveTail: false,
      source: query.logGroupNames ?? [],
    };

    return encodeUrl(urlProps, datasource.getActualRegion(query.region));
  }

  render() {
    const { href } = this.state;
    return (
      <a href={href} target="_blank" rel="noopener">
        <i className="fa fa-share-square-o" /> CloudWatch Logs Insights
      </a>
    );
  }
}
