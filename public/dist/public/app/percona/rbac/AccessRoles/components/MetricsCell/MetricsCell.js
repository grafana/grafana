import React from 'react';
import promqlGrammar from 'app/plugins/datasource/prometheus/promql';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import { styles } from './MetricsCell.styles';
const MetricsCell = ({ filter }) => (React.createElement("div", { className: styles.MetricsCell }, !!filter && React.createElement(RawQuery, { query: filter, lang: { grammar: promqlGrammar, name: 'promql' } })));
export default MetricsCell;
//# sourceMappingURL=MetricsCell.js.map