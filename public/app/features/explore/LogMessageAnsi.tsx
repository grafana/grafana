import React, { PureComponent } from 'react';
import ansicolor from 'vendor/ansicolor/ansicolor';

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
      const key = match[1].replace(/-(a-z)/g, (_, character) => character.toUpperCase());
      accumulated[key] = match[2];
    }

    return accumulated;
  }, {});
}

interface Props {
  value: string;
}

interface State {
  chunks: ParsedChunk[];
  prevValue: string;
}

export class LogMessageAnsi extends PureComponent<Props, State> {
  state = {
    chunks: [],
    prevValue: '',
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.value === state.prevValue) {
      return null;
    }

    const parsed = ansicolor.parse(props.value);

    return {
      chunks: parsed.spans.map(span => {
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

    return chunks.map((chunk, index) =>
      chunk.style ? (
        <span key={index} style={chunk.style}>
          {chunk.text}
        </span>
      ) : (
        chunk.text
      )
    );
  }
}
