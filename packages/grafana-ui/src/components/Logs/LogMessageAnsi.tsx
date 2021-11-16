import { findHighlightChunksInText } from '@grafana/data';
import ansicolor from 'ansicolor';
import React, { PureComponent } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';

interface Style {
  [key: string]: string;
}

interface ParsedChunk {
  style: Style;
  text: string;
}

function convertCSSToStyle(css: string): Style {
  return css.split(/;\s*/).reduce((accumulated, line) => {
    const match = line.match(/([^:\s]+)\s*:\s*(.+)/);

    if (match && match[1] && match[2]) {
      const key = match[1].replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      // @ts-ignore
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

interface State {
  chunks: ParsedChunk[];
  prevValue: string;
}

export class LogMessageAnsi extends PureComponent<Props, State> {
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
              style: convertCSSToStyle(span.css),
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
