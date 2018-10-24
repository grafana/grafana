import React, { PureComponent } from 'react';

interface Props {}

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
