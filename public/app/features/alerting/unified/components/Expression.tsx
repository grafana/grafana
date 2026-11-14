import { css, cx } from '@emotion/css';
import Prism, { type Grammar, type Token, type TokenStream } from 'prismjs';
import { type FC, Fragment, type ReactNode, useMemo } from 'react';

import { isSupportedExternalPrometheusFlavoredRulesSourceType } from '@grafana/alerting/internal';
import { type GrafanaTheme2 } from '@grafana/data';
import { lokiGrammar } from '@grafana/lezer-logql';
import { promqlGrammar } from '@grafana/prometheus';
import { useStyles2 } from '@grafana/ui';
import { type RulesSource } from 'app/types/unified-alerting';

type Language = 'promql' | 'logql';

import { DataSourceType } from '../utils/datasource';
import { isCloudRulesSource } from '../utils/rulesSource';

import { Well } from './Well';

interface Props {
  expression: string;
  rulesSource: RulesSource;
}

const GRAMMARS: Record<Language, Grammar> = {
  promql: promqlGrammar,
  logql: lokiGrammar,
};

// Render Prism's token stream as elements (mirroring the class names Prism's own stringify emits)
// so existing Prism CSS themes still apply. Rendering elements rather than dangerouslySetInnerHTML
// avoids any HTML-injection surface, and rendering plain text rather than an editor keeps copied
// text free of stray characters. See PR #57839.
function renderTokenStream(stream: TokenStream): ReactNode {
  if (typeof stream === 'string') {
    return stream;
  }

  const tokens = Array.isArray(stream) ? stream : [stream];
  return tokens.map((token, index) => {
    if (typeof token === 'string') {
      return <Fragment key={index}>{token}</Fragment>;
    }

    const classNames = ['token', token.type];
    if (Array.isArray(token.alias)) {
      classNames.push(...token.alias);
    } else if (token.alias) {
      classNames.push(token.alias);
    }

    return (
      <span key={index} className={classNames.join(' ')}>
        {renderTokenStream(token.content)}
      </span>
    );
  });
}

const HighlightedQuery: FC<{ language: Language; expr: string }> = ({ language, expr }) => {
  const styles = useStyles2(getStyles);
  const tokens = useMemo<Array<string | Token>>(() => Prism.tokenize(expr, GRAMMARS[language]), [expr, language]);

  return (
    <div className={cx('prism-syntax-highlight', styles.highlightedQuery)} data-testid="expression-editor">
      {renderTokenStream(tokens)}
    </div>
  );
};

// Sources with another query language (e.g. VictoriaLogs' LogsQL) have no grammar here and render as plain text.
function getLanguage(rulesSource: RulesSource): Language | undefined {
  if (!isCloudRulesSource(rulesSource)) {
    return undefined;
  }
  if (rulesSource.type === DataSourceType.Loki) {
    return 'logql';
  }
  if (isSupportedExternalPrometheusFlavoredRulesSourceType(rulesSource.type)) {
    return 'promql';
  }
  return undefined;
}

export const Expression: FC<Props> = ({ expression: query, rulesSource }) => {
  const styles = useStyles2(getStyles);
  const language = getLanguage(rulesSource);

  return (
    <Well className={styles.well}>{language ? <HighlightedQuery expr={query} language={language} /> : query}</Well>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  well: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.fontSize,
    wordBreak: 'break-word',
    overflow: 'auto',
  }),
  // Preserve newlines so multi-line queries render across multiple lines, matching the
  // previous Slate editor which split the query into separate lines.
  highlightedQuery: css({
    whiteSpace: 'pre-wrap',
  }),
});
