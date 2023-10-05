import React, { ComponentType, useEffect, useRef } from 'react';
import { Observable, ReplaySubject } from 'rxjs';

import { dateTimeFormat, DateTimeInput, EventBusSrv, PanelData, PanelPlugin, PanelProps } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { RenderEvent } from 'app/types/events';

interface AngularScopeProps {
  panel: PanelModel;
  dashboard: DashboardModel;
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

      const fakePanel = {
        events: new EventBusSrv(),
        type: plugin.meta.id,
        id: props.id,
        fieldConfig: props.fieldConfig,
        getQueryRunner: () => queryRunner,
      };

      angularState.current = {
        // @ts-ignore
        panel: fakePanel,
        // @ts-ignore
        dashboard: new FakeDashboard(),
        size: { width: props.width, height: props.height },
        queryRunner: queryRunner,
      };

      angularComponent.current = loader.load(divRef.current, angularState.current, template);

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-render react when dimensions change
    useEffect(() => {
      if (!angularComponent.current) {
        return;
      }

      angularState.current!.size.height = props.height;
      angularState.current!.size.width = props.width;
      angularState.current!.panel.events.publish(new RenderEvent());
    }, [props.width, props.height]);

    useEffect(() => {
      if (!angularState.current?.panel) {
        return;
      }

      angularState.current.queryRunner.forwardNewData(props.data);
    }, [props.data]);

    return <div ref={divRef} className="panel-height-helper" />;
  };
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

class FakeDashboard {
  events = new EventBusSrv();
  panelInitialized() {}

  getTimezone() {
    const time = sceneGraph.getTimeRange(window.__grafanaSceneContext);
    return time.getTimeZone();
  }

  sharedTooltipModeEnabled() {
    // Todo access scene sync scope
    return false;
  }

  formatDate(date: DateTimeInput, format?: string) {
    return dateTimeFormat(date, {
      format,
      timeZone: this.getTimezone(),
    });
  }
}
