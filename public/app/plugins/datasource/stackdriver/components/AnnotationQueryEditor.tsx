import React from 'react';
import { Input } from '@grafana/ui';

import { TemplateSrv } from 'app/features/templating/template_srv';
import { SelectableValue } from '@grafana/data';

import StackdriverDatasource from '../datasource';
import { Metrics, Filters, AnnotationsHelp } from './';
import { toOption } from '../functions';
import { AnnotationTarget, MetricDescriptor } from '../types';

export interface Props {
  onQueryChange: (target: AnnotationTarget) => void;
  target: AnnotationTarget;
  datasource: StackdriverDatasource;
  templateSrv: TemplateSrv;
}

interface State extends AnnotationTarget {
  variableOptionGroup: SelectableValue<string>;
  variableOptions: Array<SelectableValue<string>>;
  labels: any;
  [key: string]: any;
}

const DefaultTarget: State = {
  defaultProject: 'loading project...',
  metricType: '',
  filters: [],
  metricKind: '',
  valueType: '',
  refId: 'annotationQuery',
  title: '',
  text: '',
  labels: {},
  variableOptionGroup: {},
  variableOptions: [],
};

export class AnnotationQueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  componentDidMount() {
    const { target, datasource } = this.props;
    const variableOptionGroup = {
      label: 'Template Variables',
      options: datasource.variables.map(toOption),
    };

    this.setState({
      variableOptionGroup,
      variableOptions: variableOptionGroup.options,
      ...target,
    });

    datasource.getLabels(target.metricType, target.refId).then(labels => this.setState({ labels }));
  }

  onMetricTypeChange = ({ valueType, metricKind, type, unit }: MetricDescriptor) => {
    const { onQueryChange, datasource } = this.props;
    this.setState(
      {
        metricType: type,
        unit,
        valueType,
        metricKind,
      },
      () => {
        onQueryChange(this.state);
      }
    );
    datasource.getLabels(type, this.state.refId).then(labels => this.setState({ labels }));
  };

  onChange(prop: string, value: string | string[]) {
    this.setState({ [prop]: value }, () => {
      this.props.onQueryChange(this.state);
    });
  }

  render() {
    const {
      defaultProject,
      metricType,
      filters,
      title,
      text,
      variableOptionGroup,
      labels,
      variableOptions,
    } = this.state;
    const { datasource } = this.props;

    return (
      <>
        <Metrics
          defaultProject={defaultProject}
          metricType={metricType}
          templateSrv={datasource.templateSrv}
          datasource={datasource}
          templateVariableOptions={variableOptions}
          onChange={metric => this.onMetricTypeChange(metric)}
        >
          {metric => (
            <>
              <Filters
                labels={labels}
                filters={filters}
                onChange={value => this.onChange('filters', value)}
                variableOptionGroup={variableOptionGroup}
              />
            </>
          )}
        </Metrics>
        <div className="gf-form gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label query-keyword width-9">Title</span>
            <Input
              type="text"
              className="gf-form-input width-20"
              value={title}
              onChange={e => this.onChange('title', e.target.value)}
            />
          </div>
          <div className="gf-form">
            <span className="gf-form-label query-keyword width-9">Text</span>
            <Input
              type="text"
              className="gf-form-input width-20"
              value={text}
              onChange={e => this.onChange('text', e.target.value)}
            />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>

        <AnnotationsHelp />
      </>
    );
  }
}
