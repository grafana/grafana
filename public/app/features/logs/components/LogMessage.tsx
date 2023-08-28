import React from 'react';
import Highlighter from 'react-highlight-words';

import { findHighlightChunksInText } from '@grafana/data';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowStyles } from './getLogRowStyles';

const EMPTY_STYLE = '';
export const MAX_CHARACTERS = 100000;

interface LogMessageProps {
  hasAnsi: boolean;
  entry: string;
  highlights: string[] | undefined;
  styles: LogRowStyles;
  expandLogMessage: boolean;
}

const hasHighlightWordsInProps = (highlights: string[] | undefined, entry: string): boolean => {
  const highlightIsDefined = (highlights: string[] | undefined): boolean => {
    return typeof highlights !== undefined && highlights !== null;
  };
  const highlightHasAtLeastOneString = (highlights: string[]): boolean => {
    return highlights[0] !== undefined && highlights.length > 0 && highlights[0].length > 0;
  };
  const entryLengthIsWithinMax = (entry: string): boolean => {
    return entry.length < MAX_CHARACTERS;
  };
  return (
    highlightIsDefined(highlights) && highlightHasAtLeastOneString(highlights ?? []) && entryLengthIsWithinMax(entry)
  );
};
const createLogMessageAnsi = (
  entry: string,
  styles: LogRowStyles,
  searchWords: string[],
  needsHighlighter?: boolean
) => {
  const highlight = needsHighlighter ? { searchWords, highlightClassName: styles.logsRowMatchHighLight } : undefined;
  return <LogMessageAnsi value={entry} highlight={highlight} />;
};

const createHighliter = (entry: string, highlights: string[], styles: LogRowStyles) => {
  return (
    <Highlighter
      textToHighlight={entry}
      searchWords={highlights}
      findChunks={findHighlightChunksInText}
      highlightClassName={styles.logsRowMatchHighLight}
    />
  );
};

const defaultLogMessage = (entry: string) => {
  return <>{entry}</>;
};

const createLogMessageComponent = (hasAnsi: boolean, entry: string, highlights: string[], styles: LogRowStyles) => {
  if (hasAnsi) {
    return createLogMessageAnsi(entry, styles, highlights, hasHighlightWordsInProps(highlights, entry));
  }
  if (hasHighlightWordsInProps(highlights, entry)) {
    return createHighliter(entry, highlights, styles);
  }
  return defaultLogMessage(entry);
};

export const LogMessage = ({ expandLogMessage, hasAnsi, entry, highlights, styles }: LogMessageProps) => {
  return (
    <div className={expandLogMessage ? EMPTY_STYLE : styles.truncateToOneLine}>
      {createLogMessageComponent(hasAnsi, entry, highlights ?? [], styles)}
    </div>
  );
};
