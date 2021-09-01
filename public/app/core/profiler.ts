import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

export class Profiler {
  panelsRendered = 0;
  enabled?: boolean = undefined;
  $rootScope?: GrafanaRootScope = undefined;
  window?: any = undefined;

  init(config: any, $rootScope: GrafanaRootScope) {
    this.$rootScope = $rootScope;
    this.window = window;

    if (!this.enabled) {
      return;
    }
  }

  renderingCompleted() {
    // add render counter to root scope
    // used by image renderer to know when panel has rendered
    this.panelsRendered += 1;

    // this window variable is used by backend rendering tools to know
    // all panels have completed rendering
    this.window.panelsRendered = this.panelsRendered;
  }
}

const profiler = new Profiler();
export { profiler };
