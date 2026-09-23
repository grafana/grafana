import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

export default function JsonSyntaxHighlight({ text, theme }: { text: string; theme: GrafanaTheme2 }) {
  const tokens = useMemo(() => {
    try {
      const tokens = Prism.tokenize(text, Prism.languages.json);
      // Bound DOM cost even for short, densely packed JSON arrays.
      return tokens.filter((token) => typeof token !== 'string').length <= 5_000 ? tokens : null;
    } catch {
      return null;
    }
  }, [text]);

  if (!tokens) {
    return <>{text}</>;
  }

  const colors: Record<string, string> = {
    property: theme.components.codeEditor.variable,
    string: theme.components.codeEditor.string,
    number: theme.components.codeEditor.number,
    boolean: theme.components.codeEditor.number,
    null: theme.components.codeEditor.number,
    punctuation: theme.components.codeEditor.operator,
    operator: theme.components.codeEditor.operator,
  };

  return (
    <>
      {tokens.map((token, index) =>
        typeof token === 'string' ? (
          token
        ) : (
          <span key={index} style={{ color: colors[token.type] }}>
            {String(token.content)}
          </span>
        )
      )}
    </>
  );
}
