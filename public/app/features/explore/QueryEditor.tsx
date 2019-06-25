// Libraries
import React, { PureComponent } from 'react';

// Services
import { getAngularLoader, AngularComponent } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

// Types
import { Emitter } from 'app/core/utils/emitter';
import { DataQuery, TimeRange } from '@grafana/ui';
import 'app/features/plugins/plugin_loader';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

interface QueryEditorProps {
  error?: any;
  datasource: any;
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
          setTimeout(() => {
            this.props.onQueryChange(target);
            this.props.onExecuteQuery();
          }, 1);
        },
        onQueryChange: () => {
          setTimeout(() => {
            this.props.onQueryChange(target);
          }, 1);
        },
        events: exploreEvents,
        panel: { datasource, targets: [target] },
        dashboard: {},
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
    setTimeout(() => {
      this.props.onQueryChange(target);
      this.props.onExecuteQuery();
    }, 1);
  }

  componentDidUpdate(prevProps: QueryEditorProps) {
    if (prevProps.error !== this.props.error && this.component) {
      // Some query controllers listen to data error events and need a digest
      // for some reason this needs to be done in next tick
      setTimeout(this.component.digest);
    }
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
        from: dateTime(range.from),
        to: dateTime(range.to),
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
