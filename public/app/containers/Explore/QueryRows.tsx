import React, { PureComponent } from 'react';

import QueryField from './QueryField';

class QueryRow extends PureComponent<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      query: '',
    };
  }

  handleChangeQuery = value => {
    const { index, onChangeQuery } = this.props;
    this.setState({ query: value });
    if (onChangeQuery) {
      onChangeQuery(value, index);
    }
  };

  handleClickAddButton = () => {
    const { index, onAddQueryRow } = this.props;
    if (onAddQueryRow) {
      onAddQueryRow(index);
    }
  };

  handleClickRemoveButton = () => {
    const { index, onRemoveQueryRow } = this.props;
    if (onRemoveQueryRow) {
      onRemoveQueryRow(index);
    }
  };

  handlePressEnter = () => {
    const { onExecuteQuery } = this.props;
    if (onExecuteQuery) {
      onExecuteQuery();
    }
  };

  render() {
    const { request } = this.props;
    return (
      <div className="query-row">
        <div className="query-row-tools">
          <button className="btn btn-small btn-inverse" onClick={this.handleClickAddButton}>
            <i className="fa fa-plus" />
          </button>
          <button className="btn btn-small btn-inverse" onClick={this.handleClickRemoveButton}>
            <i className="fa fa-minus" />
          </button>
        </div>
        <div className="query-field-wrapper">
          <QueryField onPressEnter={this.handlePressEnter} onQueryChange={this.handleChangeQuery} request={request} />
        </div>
      </div>
    );
  }
}

export default class QueryRows extends PureComponent<any, any> {
  render() {
    const { className = '', queries, ...handlers } = this.props;
    return (
      <div className={className}>{queries.map((q, index) => <QueryRow key={q.key} index={index} {...handlers} />)}</div>
    );
  }
}
