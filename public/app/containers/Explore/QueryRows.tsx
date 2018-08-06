import React, { PureComponent } from 'react';

import QueryField from './PromQueryField';

class QueryRow extends PureComponent<any, {}> {
  handleChangeQuery = value => {
    const { index, onChangeQuery } = this.props;
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
    const { edited, history, query, request } = this.props;
    return (
      <div className="query-row">
        <div className="query-row-tools">
          <button className="btn navbar-button navbar-button--tight" onClick={this.handleClickAddButton}>
            <i className="fa fa-plus" />
          </button>
          <button className="btn navbar-button navbar-button--tight" onClick={this.handleClickRemoveButton}>
            <i className="fa fa-minus" />
          </button>
        </div>
        <div className="slate-query-field-wrapper">
          <QueryField
            initialQuery={edited ? null : query}
            history={history}
            portalPrefix="explore"
            onPressEnter={this.handlePressEnter}
            onQueryChange={this.handleChangeQuery}
            request={request}
          />
        </div>
      </div>
    );
  }
}

export default class QueryRows extends PureComponent<any, {}> {
  render() {
    const { className = '', queries, ...handlers } = this.props;
    return (
      <div className={className}>
        {queries.map((q, index) => (
          <QueryRow key={q.key} index={index} query={q.query} edited={q.edited} {...handlers} />
        ))}
      </div>
    );
  }
}
