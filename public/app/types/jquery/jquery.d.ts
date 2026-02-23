interface JQueryPlot {
  (element: HTMLElement | JQuery, data: any, options: any): void;
  plugins: any[];
}

interface JQueryStatic {
  plot: JQueryPlot;
}
