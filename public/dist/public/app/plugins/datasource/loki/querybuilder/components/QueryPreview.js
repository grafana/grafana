import React from 'react';
import { EditorRow, EditorFieldGroup } from '@grafana/experimental';
import { RawQuery } from '../../../prometheus/querybuilder/shared/RawQuery';
import { lokiGrammar } from '../../syntax';
export function QueryPreview({ query }) {
    return (React.createElement(EditorRow, null,
        React.createElement(EditorFieldGroup, null,
            React.createElement(RawQuery, { query: query, lang: { grammar: lokiGrammar, name: 'lokiql' } }))));
}
//# sourceMappingURL=QueryPreview.js.map