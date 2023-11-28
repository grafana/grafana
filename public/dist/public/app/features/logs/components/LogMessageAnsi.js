import ansicolor from 'ansicolor';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';
import { findHighlightChunksInText } from '@grafana/data';
import { withTheme2 } from '@grafana/ui';
function convertCSSToStyle(theme, css) {
    return css.split(/;\s*/).reduce((accumulated, line) => {
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
export class UnThemedLogMessageAnsi extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            chunks: [],
            prevValue: '',
        };
    }
    static getDerivedStateFromProps(props, state) {
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
            var _a;
            const chunkText = ((_a = this.props.highlight) === null || _a === void 0 ? void 0 : _a.searchWords) ? (React.createElement(Highlighter, { key: index, textToHighlight: chunk.text, searchWords: this.props.highlight.searchWords, findChunks: findHighlightChunksInText, highlightClassName: this.props.highlight.highlightClassName })) : (chunk.text);
            return chunk.style ? (React.createElement("span", { key: index, style: chunk.style, "data-testid": "ansiLogLine" }, chunkText)) : (chunkText);
        });
    }
}
export const LogMessageAnsi = withTheme2(UnThemedLogMessageAnsi);
LogMessageAnsi.displayName = 'LogMessageAnsi';
//# sourceMappingURL=LogMessageAnsi.js.map