// Libraries
import React, { PureComponent } from 'react';
import moment from 'moment';

// Services
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

// Types
import { Emitter } from 'app/core/utils/emitter';
import { DataQuery, TimeRange } from '@grafana/ui';
import 'app/features/plugins/plugin_loader';

interface QueryEditorProps {
  datasource: any;
  error?: string | JSX.Element;
  onExecuteQuery?: () => void;
  onQueryChange?: (value: DataQuery) => void;
  initialQuery: DataQuery;
  exploreEvents: Emitter;
  range: TimeRange;
}

export default class QueryEditor extends PureComponent<QueryEditorProps, any> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { datasource, initialQuery, exploreEvents, range } = this.props;
    this.initTimeSrv(range);

    const loader = getAngularLoader();
    const template = '<plugin-component type="query-ctrl"> </plugin-component>';
    const target = { datasource: datasource.name, ...initialQuery };
    const scopeProps = {
      ctrl: {
        datasource,
        target,
        refresh: () => {
          this.props.onQueryChange(target);
          this.props.onExecuteQuery();
        },
        onQueryChange: () => {
          this.props.onQueryChange(target);
        },
        events: exploreEvents,
        panel: { datasource, targets: [target] },
        dashboard: {},
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
    this.props.onQueryChange(target);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  initTimeSrv(range: TimeRange) {
    const timeSrv = getTimeSrv();
    timeSrv.init({
      time: {
        from: moment(range.from),
        to: moment(range.to),
      },
      refresh: false,
      getTimezone: () => 'utc',
      timeRangeUpdated: () => console.log('refreshDashboard!'),
    });
  }

  render() {
    return <div className="gf-form-query" ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
