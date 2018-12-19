import React from 'react';
import _ from 'lodash';

import { QueryMeta, Target } from '../types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import '../query_filter_ctrl';

export interface Props {
  filtersChanged: (filters) => void;
  groupBysChanged: (groupBys) => void;
  templateSrv: any;
  labelData: QueryMeta;
  loading: Promise<any>;
  target: Target;
  uiSegmentSrv: any;
}

export class Filter extends React.Component<Props, any> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { loading, labelData, target, filtersChanged, groupBysChanged } = this.props;
    const loader = getAngularLoader();
    const template = '<stackdriver-filter> </stackdriver-filter>';

    const scopeProps = {
      loading,
      labelData,
      target,
      filtersChanged,
      groupBysChanged,
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentDidUpdate() {
    const scope = this.component.getScope();
    scope.loading = _.clone(this.props.loading);
    scope.labelData = _.cloneDeep(this.props.labelData);
    scope.target = _.cloneDeep(this.props.target);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
