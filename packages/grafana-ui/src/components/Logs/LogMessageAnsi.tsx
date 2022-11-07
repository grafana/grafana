import ansicolor from 'ansicolor';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { findHighlightChunksInText, GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../themes';
import { Themeable2 } from '../../types';

interface Style {
  [key: string]: string;
}

interface ParsedChunk {
  style: Style;
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

interface Props extends Themeable2 {
  value: string;
  highlight?: {
    searchWords: string[];
    highlightClassName: string;
  };
}

interface State {
  chunks: ParsedChunk[];
  prevValue: string;
}

/** @deprecated will be removed in the next major version */
export class UnThemedLogMessageAnsi extends PureComponent<Props, State> {
  state: State = {
    chunks: [],
    prevValue: '',
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.value === state.prevValue) {
      return null;
    }

    const parsed = ansicolor.parse(props.value);

    return {
      chunks: parsed.spans.map((span) => {
        return span.css
          ? {
              style: convertCSSToStyle(props.theme, span.css),
              text: span.text,
            }
          : { text: span.text };
      }),
      prevValue: props.value,
    };
  }

  render() {
    const { chunks } = this.state;

    return chunks.map((chunk, index) => {
      const chunkText = this.props.highlight?.searchWords ? (
        <Highlighter
          key={index}
          textToHighlight={chunk.text}
          searchWords={this.props.highlight.searchWords}
          findChunks={findHighlightChunksInText}
          highlightClassName={this.props.highlight.highlightClassName}
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
  }
}

/** @deprecated will be removed in the next major version */
export const LogMessageAnsi = withTheme2(UnThemedLogMessageAnsi);
LogMessageAnsi.displayName = 'LogMessageAnsi';
