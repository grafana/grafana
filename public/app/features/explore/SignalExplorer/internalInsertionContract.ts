// Private to the paired Explore and Prometheus experiment.
// Promote a generalized interface before adding another datasource adapter.

export interface QueryEditorInsertionSelectionV1 {
  value: string;
  from: number;
  to: number;
}

export interface QueryEditorInsertionTargetV1 {
  /** The selection the user last left in the editor, or `undefined` until it has had text focus. */
  getSelection(): QueryEditorInsertionSelectionV1 | undefined;
  /** Replaces the text between the offsets, puts the cursor after it and commits the query. */
  replaceRange(from: number, to: number, text: string): void;
}

export interface QueryEditorInsertionRegistrationV1 {
  register(target: QueryEditorInsertionTargetV1): VoidFunction;
}

export interface InternalQueryEditorInsertionPropsV1 {
  unstable_queryEditorInsertionV1?: QueryEditorInsertionRegistrationV1;
}
