import React from 'react';
import { EditorFieldGroup, EditorRow } from '@grafana/experimental';
import promqlGrammar from '../../promql';
import { RawQuery } from '../shared/RawQuery';
export function QueryPreview({ query }) {
    if (!query) {
        return null;
    }
    return (React.createElement(EditorRow, null,
        React.createElement(EditorFieldGroup, null,
            React.createElement(RawQuery, { query: query, lang: { grammar: promqlGrammar, name: 'promql' } }))));
}
//# sourceMappingURL=QueryPreview.js.map