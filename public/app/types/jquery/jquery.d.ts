interface JQueryPlot {
  (element: HTMLElement | JQuery, data: any, options: any): void;
  plugins: any[];
}

interface JQueryStatic {
  plot: JQueryPlot;
}

interface JQuery {
  place_tt: any;
  modal: any;
  tagsinput: any;
  typeahead: any;
  tooltip: any;
}
