type TraceEvent = {
  name: string;
};

declare class Tracelib {
  constructor(private events: TraceEvent[]) {}

  getFPS: () => { times: number[]; values: number[] };
  getWarningCounts: () => Record<string, number>;
}
declare module 'tracelib' {
  export = Tracelib;

  export { TraceEvent };
}
