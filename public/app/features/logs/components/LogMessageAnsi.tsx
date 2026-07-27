import ansicolor from 'ansicolor';
import { memo, useMemo } from 'react';
import Highlighter from 'react-highlight-words';

import { findHighlightChunksInText, type GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

interface Style {
  [key: string]: string;
}

interface ParsedChunk {
  style?: Style;
  text: string;
}

function convertCSSToStyle(theme: GrafanaTheme2, css: string): Style {
  return css.split(/;\s*/).reduce<Style>((accumulated, line) => {
    // The ansicolor package returns this color if the chunk has the ANSI dim
    // style (`\e[2m`), but it is nearly unreadable in the dark theme, so we use
    // GrafanaTheme2 instead to style it in a way that works across all themes.
    if (line === 'color:rgba(0,0,0,0.5)') {
      return { color: theme.colors.text.secondary };
    }

    const match = line.match(/([^:\s]+)\s*:\s*(.+)/);

    if (match && match[1] && match[2]) {
      const key = match[1].replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      accumulated[key] = match[2];
    }

    return accumulated;
  }, {});
}

interface Props {
  value: string;
  highlight?: {
    searchWords: string[];
    highlightClassName: string;
  };
}

export const LogMessageAnsi = memo(function UnThemedLogMessageAnsi({ value, highlight }: Props) {
  const theme = useTheme2();

  const chunks = useMemo<ParsedChunk[]>(() => {
    const parsed = ansicolor.parse(value);
    return parsed.spans.map((span) =>
      span.css ? { style: convertCSSToStyle(theme, span.css), text: span.text } : { text: span.text }
    );
  }, [value, theme]);

  return chunks.map((chunk, index) => {
    const chunkText = highlight?.searchWords ? (
      <Highlighter
        key={index}
        textToHighlight={chunk.text}
        searchWords={highlight.searchWords}
        findChunks={findHighlightChunksInText}
        highlightClassName={highlight.highlightClassName}
      />
    ) : (
      chunk.text
    );
    return chunk.style ? (
      <span key={index} style={chunk.style} data-testid="ansiLogLine">
        {chunkText}
      </span>
    ) : (
      chunkText
    );
  });
});

LogMessageAnsi.displayName = 'LogMessageAnsi';
