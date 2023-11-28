import React, { useEffect, useRef } from 'react';
import { ReplaySubject } from 'rxjs';
import { EventBusSrv } from '@grafana/data';
import { getAngularLoader, RefreshEvent } from '@grafana/runtime';
import { RenderEvent } from 'app/types/events';
export function getAngularPanelReactWrapper(plugin) {
    return function AngularWrapper(props) {
        const divRef = useRef(null);
        const angularState = useRef();
        const angularComponent = useRef();
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
            angularState.current.size.height = props.height;
            angularState.current.size.width = props.width;
            angularState.current.panel.events.publish(new RenderEvent());
        }, [props.width, props.height]);
        // Pass new data to angular panel
        useEffect(() => {
            var _a;
            if (!((_a = angularState.current) === null || _a === void 0 ? void 0 : _a.panel)) {
                return;
            }
            angularState.current.queryRunner.forwardNewData(props.data);
        }, [props.data]);
        return React.createElement("div", { ref: divRef, className: "panel-height-helper" });
    };
}
class PanelModelCompatibilityWrapper {
    constructor(plugin, props, queryRunner) {
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
    constructor() {
        this.subject = new ReplaySubject(1);
    }
    getData(options) {
        return this.subject;
    }
    forwardNewData(data) {
        this.subject.next(data);
    }
    run() { }
}
//# sourceMappingURL=AngularPanelReactWrapper.js.map