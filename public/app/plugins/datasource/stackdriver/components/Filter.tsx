import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

import { QueryMeta } from '../types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import '../query_filter_ctrl';

export interface Props {
  filtersChanged: (filters) => void;
  groupBysChanged?: (groupBys) => void;
  metricType: string;
  templateSrv: any;
  groupBys?: string[];
  filters: string[];
  datasource: any;
  refId: string;
  hideGroupBys: boolean;
}

interface State {
  labelData: QueryMeta;
  loading: Promise<any>;
}

const defaultLabelData = {
  metricLabels: {},
  resourceLabels: {},
  resourceTypes: [],
};

export class Filter extends React.Component<Props, State> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { groupBys, filters, filtersChanged, groupBysChanged, hideGroupBys } = this.props;
    const loader = getAngularLoader();
    const template = '<stackdriver-filter> </stackdriver-filter>';

    const scopeProps = {
      loading: null,
      labelData: null,
      groupBys,
      filters,
      filtersChanged,
      groupBysChanged,
      hideGroupBys,
    };
    scopeProps.loading = this.loadLabels(scopeProps);
    this.component = loader.load(this.element, scopeProps, template);
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.element) {
      return;
    }
    const scope = this.component.getScope();
    if (prevProps.metricType !== this.props.metricType) {
      scope.loading = this.loadLabels(scope);
    }
    scope.filters = this.props.filters;
    scope.groupBys = this.props.groupBys;
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  async loadLabels(scope) {
    return new Promise(async resolve => {
      try {
        if (!this.props.metricType) {
          scope.labelData = defaultLabelData;
        } else {
          const { meta } = await this.props.datasource.getLabels(this.props.metricType, this.props.refId);
          scope.labelData = meta;
        }
        resolve();
      } catch (error) {
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.props.metricType]);
        scope.labelData = defaultLabelData;
        resolve();
      }
    });
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
