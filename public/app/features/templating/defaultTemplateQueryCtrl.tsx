import React, { PureComponent } from 'react';

interface Props {
  query: string;
}

export default class DefaultTemplateQueryCtrl extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    console.log('componentDidMount');
  }

  render() {
    return (
      <div className="gf-form">
        <span className="gf-form-label width-7">Query</span>
        <input
          type="text"
          className="gf-form-input"
          ng-model="current.query"
          placeholder="metric name or tags query"
          ng-model-onblur
          ng-change="runQuery()"
          required
        />
      </div>
    );
  }
}
