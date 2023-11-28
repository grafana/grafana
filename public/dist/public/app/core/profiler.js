export class Profiler {
    constructor() {
        this.panelsRendered = 0;
        this.enabled = undefined;
    }
    renderingCompleted() {
        // add render counter to root scope
        // used by image renderer to know when panel has rendered
        this.panelsRendered += 1;
        // this window variable is used by backend rendering tools to know
        // all panels have completed rendering
        window.panelsRendered = this.panelsRendered;
    }
}
const profiler = new Profiler();
export { profiler };
//# sourceMappingURL=profiler.js.map