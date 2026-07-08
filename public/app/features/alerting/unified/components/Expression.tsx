import { css } from '@emotion/css';
import Prism, { type Grammar } from 'prismjs';
import { type FC, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { promqlGrammar } from '@grafana/prometheus';
import { useStyles2 } from '@grafana/ui';
import LogqlSyntax from 'app/plugins/datasource/loki/syntax';
import { type RulesSource } from 'app/types/unified-alerting';

import { DataSourceType, isCloudRulesSource } from '../utils/datasource';

import { Well } from './Well';

interface Props {
  expression: string;
  rulesSource: RulesSource;
}

const GRAMMARS: Record<'promql' | 'logql', Grammar> = {
  promql: promqlGrammar,
  logql: LogqlSyntax,
};

const HighlightedQuery: FC<{ language: 'promql' | 'logql'; expr: string }> = ({ language, expr }) => {
  // Prism.highlight HTML-escapes token content, so the query is safe to inject. We render a plain
  // element rather than an editor so copied text contains no stray characters. See PR #57839.
  const html = useMemo(() => Prism.highlight(expr, GRAMMARS[language], language), [expr, language]);

  return (
    <div
      className="prism-syntax-highlight"
      data-testid="expression-editor"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const Expression: FC<Props> = ({ expression: query, rulesSource }) => {
  const styles = useStyles2(getStyles);

  return (
    <Well className={styles.well}>
      {isCloudRulesSource(rulesSource) ? (
        <HighlightedQuery expr={query} language={rulesSource.type === DataSourceType.Loki ? 'logql' : 'promql'} />
      ) : (
        query
      )}
    </Well>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  well: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.fontSize,
    wordBreak: 'break-word',
    overflow: 'auto',
  }),
});
