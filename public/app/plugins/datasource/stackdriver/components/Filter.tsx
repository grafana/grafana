import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

import { QueryMeta, Target } from '../types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import '../query_filter_ctrl';

export interface Props {
  filtersChanged: (filters) => void;
  groupBysChanged: (groupBys) => void;
  metricType: string;
  templateSrv: any;
  target: Target;
  uiSegmentSrv: any;
  datasource: any;
}

interface State {
  labelData: QueryMeta;
  loading: Promise<any>;
}

export class Filter extends React.Component<Props, State> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { target, filtersChanged, groupBysChanged } = this.props;
    const loader = getAngularLoader();
    const template = '<stackdriver-filter> </stackdriver-filter>';

    const scopeProps = {
      loading: this.loadLabels.bind(this),
      labelData: null,
      target,
      filtersChanged,
      groupBysChanged,
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.metricType !== this.props.metricType) {
      const scope = this.component.getScope();
      scope.loading = this.loadLabels(scope);
    }
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  async loadLabels(scope) {
    return new Promise(async resolve => {
      try {
        const { meta } = await this.props.datasource.getLabels(this.props.target.metricType, this.props.target.refId);
        scope.labelData = meta;
        resolve();
      } catch (error) {
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.props.target.metricType]);
        resolve();
      }
    });
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
