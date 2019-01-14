import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

import { QueryMeta } from '../types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { TemplateSrv } from 'app/features/templating/template_srv';
import StackdriverDatasource from '../datasource';
import '../query_filter_ctrl';

export interface Props {
  filtersChanged: (filters: string[]) => void;
  groupBysChanged?: (groupBys: string[]) => void;
  metricType: string;
  templateSrv: TemplateSrv;
  groupBys?: string[];
  filters: string[];
  datasource: StackdriverDatasource;
  refId: string;
  hideGroupBys: boolean;
}

interface State {
  labelData: QueryMeta;
  loading: Promise<any>;
}

const labelData = {
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

    const { groupBys, filters, hideGroupBys } = this.props;
    const loader = getAngularLoader();

    const filtersChanged = filters => {
      this.props.filtersChanged(filters);
    };

    const groupBysChanged = groupBys => {
      this.props.groupBysChanged(groupBys);
    };

    const scopeProps = {
      loading: null,
      labelData,
      groupBys,
      filters,
      filtersChanged,
      groupBysChanged,
      hideGroupBys,
    };
    const loading = this.loadLabels(scopeProps);
    scopeProps.loading = loading;
    const template = `<stackdriver-filter
                        filters="filters"
                        group-bys="groupBys"
                        label-data="labelData"
                        loading="loading"
                        filters-changed="filtersChanged(filters)"
                        group-bys-changed="groupBysChanged(groupBys)"
                        hide-group-bys="hideGroupBys"/>`;
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
          scope.labelData = labelData;
        } else {
          const { meta } = await this.props.datasource.getLabels(this.props.metricType, this.props.refId);
          scope.labelData = meta;
        }
        resolve();
      } catch (error) {
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.props.metricType]);
        scope.labelData = labelData;
        resolve();
      }
    });
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
