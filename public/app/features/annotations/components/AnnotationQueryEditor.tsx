import React, { PureComponent } from 'react';
import coreModule from 'app/core/core_module';

import { DataSourceApi, AnnotationQuery, DataQuery } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import StandardAnnotationQueryEditor from './StandardAnnotationQueryEditor';

export interface Props {
  datasource: DataSourceApi;
  annotation: AnnotationQuery<DataQuery>;
  change: (annotation: AnnotationQuery<DataQuery>) => void;
}

class AngularAnnotationQueryEditor extends PureComponent<Props> {
  element?: HTMLElement | null;
  angularCmp: AngularComponent;

  componentDidMount() {
    const loader = getAngularLoader();

    const template = '<plugin-component type="annotations-query-ctrl"> </plugin-component>';
    const scopeProps = {
      ctrl: {
        currentAnnotation: this.props.annotation,
        currentDatasource: this.props.datasource,
      },
    };

    this.angularCmp = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.angularCmp) {
      this.angularCmp.destroy();
    }
  }

  render() {
    return <div ref={element => (this.element = element)} />;
  }
}

export default class AnnotationQueryEditor extends PureComponent<Props> {
  render() {
    const { datasource } = this.props;
    if (datasource.components?.AnnotationsQueryCtrl && !datasource.annotations) {
      return <AngularAnnotationQueryEditor {...this.props} />;
    }
    return <StandardAnnotationQueryEditor {...this.props} />;
  }
}

// Careful to use a unique directive name!  many plugins already use "annotationEditor" and have conflicts
coreModule.directive('standardAnnotationEditor', [
  'reactDirective',
  (reactDirective: any) => {
    return reactDirective(AnnotationQueryEditor, ['annotation', 'datasource', 'change']);
  },
]);
