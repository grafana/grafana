import { Suggestion } from '../types';

export const componentTemplates: Suggestion[] = [
  {
    route: `/explore`,
    target: `[aria-label="Query patterns"]`,
    title: `Kickstart your query`,
    content: `This is the 'Kick start your query' button. It will help you get started with your first query!`,
    component: 'Kickstart your query',
    explanation: `Click to see a list of operation patterns that help you quickly get started adding multiple operations to your query. These include:
      \n
      \n
      Log query starters
      \n
      Metric query starters`,
    testid: 'wizard-loki-kickstart-your-query',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/#toolbar-elements',
  },
  {
    route: `/explore`,
    target: `[data-testid="label-browser-button"]`,
    title: `Label browser`,
    content: `Use the Loki label browser to navigate through your labels and values, and build queries.This is the 'Kick start your query' button. It will help you get started with your first query!`,
    component: 'Label browser',
    explanation: `To navigate Loki and build a query:\n
    \n
    1. Choose labels to locate.
    2. Search for the values of your selected labels.\n
    3. The search field supports fuzzy search, and the label browser also supports faceting to list only possible label combinations.\n
    4. Select the Show logs button to display log lines based on the selected labels, or select the Show logs rate button to show the rate based on metrics such as requests per second. Additionally, you can validate the selector by clicking the Validate selector button. Click Clear to start from the beginning.,\n`,
    testid: 'wizard-loki-label-browser',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/#toolbar-elements',
  },
  {
    route: `/explore`,
    target: `[data-testid="QueryEditorModeToggle"]`,
    title: `Query builder mode`,
    content: `Use the query builder mode to build queries using a zero-code visual interface.`,
    component: 'Query mode: builder',
    explanation: `Builder mode helps you build queries using a visual interface without needing to manually enter LogQL. This option is best for users who have limited or no previous experience working with Loki and LogQL.`,
    testid: 'wizard-loki-query-builder',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/#builder-mode',
  },
  {
    route: `/explore`,
    target: `[data-testid="QueryEditorModeToggle"]`,
    title: `Code editor mode`,
    content: `Use the query editor mode to build queries using a code editor with query validation and autocomplete support.`,
    component: 'Query mode: code',
    explanation: `In Code mode, you can write complex queries using a text editor with autocompletion feature, syntax highlighting, and query validation. It also contains a label browser to further help you write queries.\n
      For more information about Loki’s query language, refer to the Loki documentation.`,
    testid: 'wizard-loki-code-editor',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/#code-mode',
  },
  {
    route: `/explore`,
    target: `[data-testid="loki-editor"]`,
    title: `Loki query editor`,
    content: `The Loki data source’s query editor helps you create log and metric queries that use Loki’s query language, LogQL.`,
    component: 'Loki query editor',
    explanation: `In Code mode, you can write complex queries using a text editor with autocompletion feature, syntax highlighting, and query validation. It also contains a label browser to further help you write queries.`,
    testid: 'wizard-loki-query-editor',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/#code-mode',
  },
];
