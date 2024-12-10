import { css, cx } from '@emotion/css';
import { languages as prismLanguages } from 'prismjs';
import { FC, useMemo } from 'react';
import { Editor } from 'slate-react';

import { GrafanaTheme2 } from '@grafana/data';
import { promqlGrammar } from '@grafana/prometheus';
import { SlatePrism, makeValue, useStyles2 } from '@grafana/ui';
import LogqlSyntax from 'app/plugins/datasource/loki/syntax';
import { RulesSource } from 'app/types/unified-alerting';

import { DataSourceType, isCloudRulesSource } from '../utils/datasource';

import { Well } from './Well';

interface Props {
  expression: string;
  rulesSource: RulesSource;
}

export const HighlightedQuery: FC<{ language: 'promql' | 'logql'; expr: string }> = ({ language, expr }) => {
  const plugins = useMemo(
    () => [
      SlatePrism(
        {
          onlyIn: (node) => 'type' in node && node.type === 'code_block',
          getSyntax: () => language,
        },
        { ...prismLanguages, [language]: language === 'logql' ? LogqlSyntax : promqlGrammar }
      ),
    ],
    [language]
  );

  const slateValue = useMemo(() => makeValue(expr), [expr]);

  //We don't want to set readOnly={true} to the Editor to prevent unwanted charaters in the copied text. See https://github.com/grafana/grafana/pull/57839
  return <Editor data-testid={'expression-editor'} plugins={plugins} value={slateValue} />;
};

export const Expression: FC<Props> = ({ expression: query, rulesSource }) => {
  const styles = useStyles2(getStyles);

  return (
    <Well className={cx(styles.well, 'slate-query-field')}>
      {isCloudRulesSource(rulesSource) ? (
        <HighlightedQuery expr={query} language={rulesSource.type === DataSourceType.Loki ? 'logql' : 'promql'} />
      ) : (
        query
      )}
    </Well>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  well: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});
