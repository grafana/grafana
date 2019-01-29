import KustoQueryField from './KustoQueryField';
import Kusto from './kusto';

import React, { Component } from 'react';
import coreModule from 'app/core/core_module';

class Editor extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      edited: false,
      query: props.query || '',
    };
  }

  onChangeQuery = value => {
    const { index, change } = this.props;
    const { query } = this.state;
    const edited = query !== value;
    this.setState({ edited, query: value });
    if (change) {
      change(value, index);
    }
  };

  onPressEnter = () => {
    const { execute } = this.props;
    if (execute) {
      execute();
    }
  };

  render() {
    const { request, variables } = this.props;
    const { edited, query } = this.state;

    return (
      <div className="gf-form-input" style={{ height: 'auto' }}>
        <KustoQueryField
          initialQuery={edited ? null : query}
          onPressEnter={this.onPressEnter}
          onQueryChange={this.onChangeQuery}
          prismLanguage="kusto"
          prismDefinition={Kusto}
          placeholder="Enter a query"
          request={request}
          templateVariables={variables}
        />
      </div>
    );
  }
}

coreModule.directive('kustoEditor', [
  'reactDirective',
  reactDirective => {
    return reactDirective(Editor, ['change', 'database', 'execute', 'query', 'request', 'variables']);
  },
]);
