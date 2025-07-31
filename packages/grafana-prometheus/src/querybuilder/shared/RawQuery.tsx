// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/RawQuery.tsx
import { css, cx } from '@emotion/css';
import Prism, { Grammar } from 'prismjs';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

interface Props {
  query: string;
  lang: {
    grammar: Grammar;
    name: string;
  };
  className?: string;
}

export function RawQuery({ query, lang, className }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const highlighted = Prism.highlight(query, lang.grammar, lang.name);

  return (
    <div
      className={cx(styles.editorField, 'prism-syntax-highlight', className)}
      aria-label={t('grafana-prometheus.querybuilder.raw-query.aria-label-selector', 'selector')}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
