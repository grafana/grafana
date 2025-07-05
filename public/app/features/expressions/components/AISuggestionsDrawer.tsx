import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { CodeEditor, Drawer, useStyles2, Stack, Button, Card, Text } from '@grafana/ui';

interface AISuggestionsDrawerProps {
  isOpen: boolean;
  onApplySuggestion: (suggestion: string) => void;
  onClose: () => void;
  suggestions: string[];
}

export const AISuggestionsDrawer = ({ isOpen, onApplySuggestion, onClose, suggestions }: AISuggestionsDrawerProps) => {
  const styles = useStyles2(getStyles);

  const copySuggestionToClipboard = async (suggestion: string) => {
    try {
      await navigator.clipboard.writeText(suggestion);
    } catch (err) {
      console.error('Failed to copy suggestion to clipboard:', err);
    }
  };

  /**
   * Parses AI-generated suggestions that contain mixed content (text and code blocks).
   *
   * AI responses often come in markdown format with explanatory text and code blocks
   * delimited by triple backticks (```). This function separates and structures that
   * content for proper rendering in the UI.
   *
   * @param suggestion - Raw AI suggestion string potentially containing markdown code blocks
   * @returns Array of parsed parts, each with:
   *   - type: 'text' for explanatory content, 'code' for SQL queries
   *   - content: The actual text or code content
   *   - language: For code blocks, the detected language (defaults to 'sql', normalized to 'mysql')
   *
   * Example input: "Here's a query:\n```sql\nSELECT * FROM A\n```\nThis joins data."
   * Example output: [
   *   { type: 'text', content: "Here's a query:" },
   *   { type: 'code', content: 'SELECT * FROM A', language: 'mysql' },
   *   { type: 'text', content: 'This joins data.' }
   * ]
   */
  const parseSuggestion = (suggestion: string) => {
    // Remove common LLM response prefixes that don't add value
    const cleanedSuggestion = suggestion.replace(/^(Certainly!?|Sure!?|Of course!?|Absolutely!?|Yes!?)\s*/i, '').trim();

    if (!cleanedSuggestion) {
      return [];
    }
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];

    // Split by triple backticks to find code blocks
    const segments = cleanedSuggestion.split(/```/);

    segments.forEach((segment, index) => {
      if (index % 2 === 0) {
        // Even indices are text (outside code blocks)
        if (segment.trim()) {
          parts.push({ type: 'text', content: segment.trim() });
        }
      } else {
        // Odd indices are code blocks
        const lines = segment.split('\n');
        let language = 'sql'; // default language
        let codeContent = segment;

        // Check if first line specifies a language
        if (lines[0] && lines[0].trim() && !lines[0].includes(' ')) {
          language = lines[0].trim().toLowerCase();
          codeContent = lines.slice(1).join('\n');
        }

        // Remove trailing newlines
        codeContent = codeContent.replace(/\n+$/, '');

        if (codeContent.trim()) {
          const finalLanguage = language === 'mysql' ? 'mysql' : language === 'sql' ? 'mysql' : language;
          parts.push({
            type: 'code',
            content: codeContent.trim(),
            language: finalLanguage,
          });
        }
      }
    });

    return parts;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      onClose={onClose}
      size="lg"
      title={<Trans i18nKey="sql-expressions.ai-suggestions-drawer-title">AI SQL Suggestions</Trans>}
    >
      <div className={styles.content}>
        <Stack direction="column" gap={3}>
          <div className={styles.header}>
            <Text element="h4">
              <Trans i18nKey="sql-expressions.suggestions-history-title">SQL Suggestions History</Trans>
            </Text>
          </div>

          <div className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => {
              const parsedSuggestion = parseSuggestion(suggestion);
              const isLatest = index === 0;

              return (
                <Card key={index} className={isLatest ? styles.latestSuggestion : ''}>
                  <div className={styles.suggestionContent}>
                    {parsedSuggestion.map(({ type, content, language }, partIndex) => (
                      <div key={partIndex} className={styles.suggestionPart}>
                        {type === 'code' ? (
                          <div className={styles.codeBlock}>
                            <div className={styles.codeHeader}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Text variant="bodySmall" weight="bold">
                                  <Trans
                                    i18nKey="sql-expressions.code-label"
                                    values={{ language: language?.toUpperCase() || 'CODE' }}
                                  >
                                    {language?.toUpperCase() || 'CODE'}
                                  </Trans>
                                </Text>
                                <Stack direction="row" gap={1}>
                                  <Button
                                    variant="secondary"
                                    fill="text"
                                    icon="copy"
                                    onClick={() => copySuggestionToClipboard(content)}
                                  >
                                    <Trans i18nKey="sql-expressions.copy">Copy</Trans>
                                  </Button>
                                  <Button
                                    variant="primary"
                                    fill="text"
                                    icon="arrow-right"
                                    onClick={() => onApplySuggestion(content)}
                                  >
                                    <Trans i18nKey="sql-expressions.apply">Apply</Trans>
                                  </Button>
                                </Stack>
                              </Stack>
                            </div>
                            <CodeEditor
                              value={content}
                              language={language === 'sql' || language === 'mysql' ? 'mysql' : 'sql'}
                              width="100%"
                              height={Math.max(80, Math.min(300, (content.split('\n').length + 1) * 20))}
                              readOnly={true}
                              showMiniMap={false}
                              showLineNumbers={true}
                              monacoOptions={{
                                lineNumbers: 'on',
                                folding: false,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                renderLineHighlight: 'none',
                                wordWrap: 'on',
                                readOnly: true,
                                contextmenu: false,
                                padding: { top: 8, bottom: 8 },
                                automaticLayout: true,
                                fontSize: 13,
                                lineHeight: 20,
                              }}
                            />
                          </div>
                        ) : (
                          <div className={styles.textBlock}>
                            <div
                              className="markdown-html"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </Stack>
      </div>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  emptyState: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: theme.spacing(2),
  }),
  header: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(2),
  }),
  suggestionsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    overflow: 'auto',
    flex: 1,
  }),
  suggestionCard: css({
    padding: theme.spacing(1.5),
  }),
  latestSuggestion: css({
    border: `2px solid ${theme.colors.primary.main}`,
    position: 'relative',
    '&::before': {
      content: '"Latest"',
      position: 'absolute',
      top: theme.spacing(-0.5),
      right: theme.spacing(1),
      backgroundColor: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  suggestionContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    width: '100%',
  }),
  suggestionPart: css({
    display: 'block',
    width: '100%',
  }),
  codeBlock: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    marginBottom: theme.spacing(1),
    width: '100%',
  }),
  codeHeader: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  textBlock: css({
    padding: theme.spacing(1, 0),
    lineHeight: theme.typography.body.lineHeight,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,

    // Ensure markdown content flows properly
    '& .markdown-html': {
      // Remove default margins for first and last elements to prevent extra spacing
      '& > :first-child': {
        marginTop: 0,
      },
      '& > :last-child': {
        marginBottom: 0,
      },
    },
  }),
});
