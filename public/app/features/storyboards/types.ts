import { DataFrame, DataQuery, RawTimeRange } from '@grafana/data';

export enum CellTypes {
  Markdown = 'markdown',
  Snapshot = 'snapshot',
  LibraryPanel = 'library-panel',
}

export interface Cell<T> {
  id: string;
  type: CellTypes;
  content: T;
}

export interface Storyboard {
  title: string;
  uid: string;
  /**
   *  String with the entire Starboard notebook
   */
  notebook: UnevaluatedStoryboardDocument;
}

type StoryboardId = string;

export interface StoryboardVariable {
  value: unknown;
  element?: StoryboardDocumentElement;
  stdout?: string;
  error?: string;
}

export interface StoryboardContext {
  [property: string]: StoryboardVariable;
}

interface StoryboardCellBase {
  id: StoryboardId;
  isEditorVisible: boolean;
  isResultVisible: boolean;
}

export interface StoryboardPlainText extends StoryboardCellBase {
  type: 'plaintext';
  content: string;
}

export interface StoryboardCsv extends StoryboardCellBase {
  type: 'csv';
  content: {
    text: string;
    /**
     * Optional in the case no input has been given
     */
    data?: DataFrame[];
  };
}

export interface StoryboardMarkdown extends StoryboardCellBase {
  type: 'markdown';
  content: string;
  editing: boolean;
}

export interface StoryboardPython extends StoryboardCellBase {
  type: 'python';
  script: string;
  returnsDF: boolean;
}

// FIXME: Terrible hack
export interface DataQuerySubclass extends DataQuery {
  [x: string | symbol | number]: any;
}

export interface StoryboardDatasourceQuery extends StoryboardCellBase {
  type: 'query';
  datasourceUid: string | null;
  query: DataQuerySubclass;
  timeRange: RawTimeRange;
}

export interface StoryboardTimeseriesPlot extends StoryboardCellBase {
  type: 'timeseries-plot';
  from: StoryboardId;
}

export type StoryboardDocumentElement =
  | StoryboardPlainText
  | StoryboardCsv
  | StoryboardMarkdown
  | StoryboardPython
  | StoryboardDatasourceQuery
  | StoryboardTimeseriesPlot;

// Describes an unevaluated Storyboard (no context)
export interface CoreStoryboardDocument {
  title: string;
  elements: StoryboardDocumentElement[];
}

export interface UnevaluatedStoryboardDocument extends CoreStoryboardDocument {
  status: 'unevaluated';
}

// Evaluated Storyboards have context, which is just results from evaluation bound to names. context is
// constructed as we evaluate, and then documents can observe the results appear
export interface EvaluatedStoryboardDocument extends CoreStoryboardDocument {
  status: 'evaluating' | 'evaluated';
  context: StoryboardContext;
}

export type StoryboardDocument = EvaluatedStoryboardDocument | UnevaluatedStoryboardDocument;
