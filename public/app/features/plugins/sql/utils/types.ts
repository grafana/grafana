import { monacoTypes } from '@grafana/ui';

export interface Editor {
  tokenize: (value: string, languageId: string) => monacoTypes.Token[][];
}

export interface Range {
  containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => boolean;
}

export interface Monaco {
  editor: Editor;
  Range: Range;
}
