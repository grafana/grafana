import React, { PureComponent } from 'react';
import DatasourceSrv from 'app/features/plugins/datasource_srv';

interface Props {
  query: string;
  datasourceSrv: DatasourceSrv;
  isValid: any;
}

export class StackdriverTemplateQueryCtrl extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    console.log('componentDidMount');
  }

  render() {
    return <h1>Hello Stackdriver Template Query</h1>;
  }
}
