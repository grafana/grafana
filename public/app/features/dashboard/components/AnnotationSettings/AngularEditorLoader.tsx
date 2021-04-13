import React from 'react';
import { AnnotationQuery, DataSourceApi } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';

export interface Props {
  annotation: AnnotationQuery;
  datasource: DataSourceApi;
  onChange: (annotation: AnnotationQuery) => void;
}

export class AngularEditorLoader extends React.PureComponent<Props> {
  ref: HTMLDivElement | null = null;
  angularComponent: AngularComponent;

  componentWillUnmount() {
    if (this.angularComponent) {
      this.angularComponent.destroy();
    }
  }

  componentDidMount() {
    if (this.ref) {
      this.loadAngular();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.datasource !== this.props.datasource) {
      this.loadAngular();
    }

    if (this.angularComponent && prevProps.annotation !== this.props.annotation) {
      this.angularComponent.getScope().ctrl.currentAnnotation = this.props.annotation;
    }
  }

  loadAngular() {
    if (this.angularComponent) {
      this.angularComponent.destroy();
    }

    const loader = getAngularLoader();
    const template = `<plugin-component ng-if="!ctrl.currentDatasource.annotations" type="annotations-query-ctrl"> </plugin-component>`;
    const scopeProps = {
      ctrl: {
        currentDatasource: this.props.datasource,
        currentAnnotation: this.props.annotation,
      },
    };

    this.angularComponent = loader.load(this.ref, scopeProps, template);
    this.angularComponent.digest();
    this.angularComponent.getScope().$watch(() => {
      this.props.onChange({
        ...scopeProps.ctrl.currentAnnotation,
      });
    });
  }

  render() {
    return <div ref={(element) => (this.ref = element)} />;
  }
}
