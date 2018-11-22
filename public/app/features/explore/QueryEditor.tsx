import React, { PureComponent } from 'react';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import 'app/features/panel/metrics_wrapper';
import { DataQuery } from 'app/types';

interface QueryEditorProps {
  datasource: any;
  error?: string | JSX.Element;
  onExecuteQuery?: () => void;
  onQueryChange?: (value: DataQuery, override?: boolean) => void;
}

export default class QueryEditor extends PureComponent<QueryEditorProps, any> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { datasource } = this.props;
    const loader = getAngularLoader();
    const template = '<metrics-wrapper />';
    const target = { datasource: datasource.name };
    // const changeableTarget = onChange(target, () => console.log(target));
    // const changeable = onChange(target, () => console.log(target));
    const scopeProps = {
      target, //: changeable,
      ctrl: {
        refresh: () => {
          this.props.onQueryChange({ refId: 'TEST', ...target }, false);
          this.props.onExecuteQuery();
        },
        events: {
          on: () => {},
        },
        panel: {
          datasource,
        },
        dashboard: {
          getNextQueryLetter: x => 'TEST',
        },
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
