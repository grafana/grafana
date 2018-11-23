import React, { PureComponent } from 'react';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { Emitter } from 'app/core/utils/emitter';
import { DataQuery } from 'app/types';
import 'app/features/plugins/plugin_loader';

interface QueryEditorProps {
  datasource: any;
  error?: string | JSX.Element;
  onExecuteQuery?: () => void;
  onQueryChange?: (value: DataQuery, override?: boolean) => void;
  initialQuery: DataQuery;
  exploreEvents: Emitter;
}

export default class QueryEditor extends PureComponent<QueryEditorProps, any> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { datasource, initialQuery, exploreEvents } = this.props;
    const loader = getAngularLoader();
    const template = '<plugin-component type="query-ctrl"> </plugin-component>';
    const target = { datasource: datasource.name };
    const scopeProps = {
      target,
      ctrl: {
        refresh: () => {
          this.props.onQueryChange({ refId: initialQuery.refId, ...target }, false);
          this.props.onExecuteQuery();
        },
        events: exploreEvents,
        panel: {
          datasource,
          targets: [{}],
        },
        dashboard: {
          getNextQueryLetter: x => '',
        },
        hideEditorRowActions: true,
        interval: '1m',
        intervalMs: 60000,
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
