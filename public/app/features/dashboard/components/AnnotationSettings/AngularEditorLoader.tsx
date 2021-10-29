import React from 'react';
import { AnnotationQuery, DataSourceApi } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';

export interface Props {
  annotation: AnnotationQuery;
  datasource: DataSourceApi;
  onChange: (annotation: AnnotationQuery) => void;
}

interface ScopeProps {
  ctrl: {
    currentDatasource: DataSourceApi;
    currentAnnotation: AnnotationQuery;
    ignoreNextWatcherFiring: boolean;
  };
}

export class AngularEditorLoader extends React.PureComponent<Props> {
  ref: HTMLDivElement | null = null;
  angularComponent?: AngularComponent;
  scopeProps?: ScopeProps;

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

    if (this.scopeProps && this.scopeProps.ctrl.currentAnnotation !== this.props.annotation) {
      this.scopeProps.ctrl.ignoreNextWatcherFiring = true;
      this.scopeProps.ctrl.currentAnnotation = this.props.annotation;
      this.angularComponent?.digest();
    }
  }

  loadAngular() {
    if (this.angularComponent) {
      this.angularComponent.destroy();
      this.scopeProps = undefined;
    }

    const loader = getAngularLoader();
    // Why is template wrapped in a div?
    // If it's not wrapped in a div, this gets compiled by AngularLoader into something like:
    // <!-- ngIf: !ctrl.currentDatasource.annotations -->
    // <plugin-component ng-if="!ctrl.currentDatasource.annotations" type="annotations-query-ctrl" class="ng-scope">
    // <!-- end ngIf: !ctrl.currentDatasource.annotations -->
    // When AngularLoader then tries to remove the element, it only removes the first line (comment) ???
    const template = `<div><plugin-component ng-if="!ctrl.currentDatasource.annotations" type="annotations-query-ctrl"> </plugin-component></div>`;
    const scopeProps = {
      ctrl: {
        currentDatasource: this.props.datasource,
        currentAnnotation: this.props.annotation,
        ignoreNextWatcherFiring: false,
      },
    };

    this.angularComponent = loader.load(this.ref, scopeProps, template);
    this.angularComponent.digest();
    this.angularComponent.getScope().$watch(() => {
      // To avoid recursive loop when the annotation is updated from outside angular in componentDidUpdate
      if (scopeProps.ctrl.ignoreNextWatcherFiring) {
        scopeProps.ctrl.ignoreNextWatcherFiring = false;
        return;
      }

      this.props.onChange(scopeProps.ctrl.currentAnnotation);
    });

    this.scopeProps = scopeProps;
  }

  render() {
    return <div ref={(element) => (this.ref = element)} />;
  }
}
