import React from 'react';
import _ from 'lodash';

import { OptionPicker } from './OptionPicker';
import { OptionGroupPicker } from './OptionGroupPicker';

export interface Props {
  onChange: (metricDescriptor) => void;
  templateSrv: any;
  datasource: any;
  defaultProject: string;
  metricType: string;
}

interface State {
  metricDescriptors: any[];
  metrics: any[];
  services: any[];
  service: string;
  metric: string;
}

export class MetricPicker extends React.Component<Props, State> {
  state: State = {
    metricDescriptors: [],
    metrics: [],
    services: [],
    service: '',
    metric: '',
  };

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.getCurrentProject()
      .then(this.loadMetricDescriptors.bind(this))
      .then(this.initializeServiceAndMetrics.bind(this));
    // .then(this.getLabels.bind(this));
  }

  async getCurrentProject() {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.props.defaultProject || this.props.defaultProject === 'loading project...') {
          // this.props.defaultProject = await this.props.datasource.getDefaultProject();
          await this.props.datasource.getDefaultProject();
        }
        resolve(this.props.defaultProject);
      } catch (error) {
        // appEvents.emit('ds-request-error', error);
        reject();
      }
    });
  }

  async loadMetricDescriptors() {
    if (this.props.defaultProject !== 'loading project...') {
      const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.defaultProject);
      this.setState({ metricDescriptors });
      return metricDescriptors;
    } else {
      return [];
    }
  }

  async initializeServiceAndMetrics() {
    const { metricDescriptors } = this.state;
    const services = this.getServicesList(metricDescriptors);
    const metrics = this.getMetricsList(metricDescriptors);
    const service = metrics.length > 0 ? metrics[0].service : '';
    this.setState({ metricDescriptors, services, metrics, service: service });
  }

  getMetricsList(metricDescriptors) {
    const selectedMetricDescriptor = metricDescriptors.find(md => md.type === this.props.metricType);
    const metricsByService = metricDescriptors.filter(m => m.service === selectedMetricDescriptor.service).map(m => ({
      service: m.service,
      value: m.type,
      label: m.displayName,
      description: m.description,
    }));
    return metricsByService;
  }

  handleServiceChange(service) {
    console.log('handleServiceChange', service);
    const { metricDescriptors } = this.state;
    const { templateSrv, metricType } = this.props;

    const metrics = metricDescriptors.filter(m => m.service === templateSrv.replace(service)).map(m => ({
      service: m.service,
      value: m.type,
      label: m.displayName,
      description: m.description,
    }));

    this.setState({ service, metrics });

    if (metrics.length > 0 && !metrics.some(m => m.value === templateSrv.replace(metricType))) {
      this.handleMetricTypeChange(metrics[0].value);
    }
  }

  handleMetricTypeChange(value) {
    const selectedMetricDescriptor = this.state.metricDescriptors.find(md => md.type === value);
    this.props.onChange(selectedMetricDescriptor);
  }

  getServicesList(metricDescriptors) {
    const services = metricDescriptors.map(m => ({
      value: m.service,
      label: _.startCase(m.serviceShortName),
    }));

    return services.length > 0 ? _.uniqBy(services, s => s.value) : [];
  }

  getTemplateVariablesGroup() {
    return {
      label: 'Template Variables',
      options: this.props.templateSrv.variables.map(v => ({
        label: `$${v.name}`,
        value: `$${v.name}`,
      })),
    };
  }

  getMetricGroups() {
    return [
      this.getTemplateVariablesGroup(),
      {
        label: 'Metrics',
        options: this.state.metrics,
      },
    ];
  }

  render() {
    const { services, service } = this.state;
    const { metricType } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label width-9 query-keyword">Service</span>
            <OptionPicker
              onChange={value => this.handleServiceChange(value)}
              selected={service}
              options={services}
              searchable={false}
              placeholder="Select Services"
              className="width-15"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label width-9 query-keyword">Metric</span>
            <OptionGroupPicker
              onChange={value => this.handleMetricTypeChange(value)}
              selected={metricType}
              groups={this.getMetricGroups()}
              searchable={true}
              placeholder="Select Metric"
              className="width-15"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </React.Fragment>
    );
  }
}
