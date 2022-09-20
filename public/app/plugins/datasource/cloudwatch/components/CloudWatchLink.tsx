import React, { Component } from 'react';

import { PanelData } from '@grafana/data';
import { Icon } from '@grafana/ui';

import { encodeUrl, AwsUrl } from '../aws_url';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchLogsQuery } from '../types';

interface Props {
  query: CloudWatchLogsQuery;
  panelData?: PanelData;
  datasource: CloudWatchDatasource;
}

interface State {
  href: string;
}

export default class CloudWatchLink extends Component<Props, State> {
  state: State = { href: '' };

  async componentDidUpdate(prevProps: Props) {
    const { panelData: panelDataNew } = this.props;
    const { panelData: panelDataOld } = prevProps;

    if (panelDataOld !== panelDataNew && panelDataNew?.request) {
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

    return encodeUrl(urlProps, datasource.api.getActualRegion(query.region));
  }

  render() {
    const { href } = this.state;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Icon name="share-alt" /> CloudWatch Logs Insights
      </a>
    );
  }
}
