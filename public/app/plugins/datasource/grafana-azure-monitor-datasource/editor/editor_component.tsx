import KustoQueryField from './KustoQueryField';
import Kusto from './kusto/kusto';

import React, { Component } from 'react';
import coreModule from 'app/core/core_module';

interface EditorProps {
  index: number;
  placeholder?: string;
  change: (value: string, index: number) => void;
  variables: () => string[] | string[];
  getSchema?: () => Promise<any>;
  execute?: () => void;
  query?: string;
}

class Editor extends Component<EditorProps, any> {
  static defaultProps = {
    placeholder: 'Enter a query',
  };

  constructor(props: EditorProps) {
    super(props);
    this.state = {
      edited: false,
      query: props.query || '',
    };
  }

  onChangeQuery = (value: any) => {
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
    const { variables, getSchema, placeholder } = this.props;
    const { edited, query } = this.state;

    return (
      <div className="gf-form-input" style={{ height: 'auto' }}>
        <KustoQueryField
          initialQuery={edited ? null : query}
          onPressEnter={this.onPressEnter}
          onQueryChange={this.onChangeQuery}
          prismLanguage="kusto"
          prismDefinition={Kusto}
          placeholder={placeholder}
          templateVariables={variables}
          getSchema={getSchema}
        />
      </div>
    );
  }
}

coreModule.directive('kustoEditor', [
  'reactDirective',
  reactDirective => {
    return reactDirective(Editor, [
      'change',
      'database',
      'execute',
      'query',
      'variables',
      'placeholder',
      ['getSchema', { watchDepth: 'reference' }],
    ]);
  },
]);
