declare global {
  interface JQueryPlot {
    (element: HTMLElement | JQuery, data: unknown, options: unknown): void;
    plugins: unknown[];
  }

  interface JQueryStatic {
    plot: JQueryPlot;
  }
}

export {};
