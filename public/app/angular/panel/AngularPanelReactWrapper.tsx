import React, { ComponentType, useEffect, useRef } from 'react';
import { Observable, ReplaySubject } from 'rxjs';

import { EventBusSrv, PanelData, PanelPlugin, PanelProps, FieldConfigSource } from '@grafana/data';
import { AngularComponent, getAngularLoader, RefreshEvent } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModelCompatibilityWrapper } from 'app/features/dashboard-scene/utils/DashboardModelCompatibilityWrapper';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { RenderEvent } from 'app/types/events';

interface AngularScopeProps {
  panel: PanelModelCompatibilityWrapper;
  dashboard: DashboardModelCompatibilityWrapper;
  queryRunner: FakeQueryRunner;
  size: {
    height: number;
    width: number;
  };
}

export function getAngularPanelReactWrapper(plugin: PanelPlugin): ComponentType<PanelProps> {
  return function AngularWrapper(props: PanelProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const angularState = useRef<AngularScopeProps | undefined>();
    const angularComponent = useRef<AngularComponent | undefined>();

    useEffect(() => {
      if (!divRef.current) {
        return;
      }

      const loader = getAngularLoader();
      const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
      const queryRunner = new FakeQueryRunner();
      const fakePanel = new PanelModelCompatibilityWrapper(plugin, props, queryRunner);

      angularState.current = {
        // @ts-ignore
        panel: fakePanel,
        // @ts-ignore
        dashboard: getDashboardSrv().getCurrent(),
        size: { width: props.width, height: props.height },
        queryRunner: queryRunner,
      };

      angularComponent.current = loader.load(divRef.current, angularState.current, template);

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-render angular panel when dimensions change
    useEffect(() => {
      if (!angularComponent.current) {
        return;
      }

      angularState.current!.size.height = props.height;
      angularState.current!.size.width = props.width;
      angularState.current!.panel.events.publish(new RenderEvent());
    }, [props.width, props.height]);

    // Pass new data to angular panel
    useEffect(() => {
      if (!angularState.current?.panel) {
        return;
      }

      angularState.current.queryRunner.forwardNewData(props.data);
    }, [props.data]);

    return <div ref={divRef} className="panel-height-helper" />;
  };
}

class PanelModelCompatibilityWrapper {
  id: number;
  type: string;
  title: string;
  plugin: PanelPlugin;
  events: EventBusSrv;
  queryRunner: FakeQueryRunner;
  fieldConfig: FieldConfigSource;
  options: Record<string, unknown>;

  constructor(plugin: PanelPlugin, props: PanelProps, queryRunner: FakeQueryRunner) {
    // Assign legacy "root" level options
    if (props.options.angularOptions) {
      Object.assign(this, props.options.angularOptions);
    }

    this.id = props.id;
    this.type = plugin.meta.id;
    this.title = props.title;
    this.fieldConfig = props.fieldConfig;
    this.options = props.options;

    this.plugin = plugin;
    this.events = new EventBusSrv();
    this.queryRunner = queryRunner;
  }

  refresh() {
    this.events.publish(new RefreshEvent());
  }

  render() {
    this.events.publish(new RenderEvent());
  }

  getQueryRunner() {
    return this.queryRunner;
  }
}

class FakeQueryRunner {
  private subject = new ReplaySubject<PanelData>(1);

  getData(options: GetDataOptions): Observable<PanelData> {
    return this.subject;
  }

  forwardNewData(data: PanelData) {
    this.subject.next(data);
  }

  run() {}
}
