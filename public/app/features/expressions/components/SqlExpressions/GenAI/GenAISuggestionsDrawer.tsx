import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { CodeEditor, Drawer, useStyles2, Stack, Button, Card, Text, ClipboardButton } from '@grafana/ui';

import { parseSuggestion } from './utils';

interface AISuggestionsDrawerProps {
  isOpen: boolean;
  onApplySuggestion: (suggestion: string) => void;
  onClose: () => void;
  suggestions: string[];
}

export const GenAISuggestionsDrawer = ({
  isOpen,
  onApplySuggestion,
  onClose,
  suggestions,
}: AISuggestionsDrawerProps) => {
  const styles = useStyles2(getStyles);

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      onClose={onClose}
      size="lg"
      title={<Trans i18nKey="sql-expressions.sql-suggestion-history">SQL Suggestion History</Trans>}
    >
      <div className={styles.content} data-testid="suggestions-drawer">
        <Stack direction="column" gap={3}>
          <div className={styles.timelineContainer}>
            {/* Vertical timeline line */}
            <div className={styles.timelineLine} />

            <div className={styles.suggestionsList}>
              {suggestions.map((suggestion, index) => {
                const parsedSuggestion = parseSuggestion(suggestion);
                const isLatest = index === 0;

                return (
                  <div key={index} className={styles.timelineItem}>
                    {/* Timeline node */}
                    <div
                      className={`${styles.timelineNode} ${isLatest ? styles.timelineNodeActive : styles.timelineNodeInactive}`}
                    />
                    <Card noMargin key={index} className={isLatest ? styles.latestSuggestion : ''}>
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
                                        {'{{ language }}'}
                                      </Trans>
                                    </Text>
                                    <Stack direction="row" gap={1}>
                                      <ClipboardButton
                                        size="sm"
                                        icon="copy"
                                        variant="secondary"
                                        getText={() => content}
                                      >
                                        <Trans i18nKey="sql-expressions.copy">Copy</Trans>
                                      </ClipboardButton>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        icon="ai-sparkle"
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
                              <div
                                className="markdown-html"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
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
  timelineContainer: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    flex: 1,
    paddingLeft: theme.spacing(4.5), // Space for timeline line and nodes
  }),
  timelineLine: css({
    position: 'absolute',
    // Offset the 2px width of the timeline line
    left: `calc(${theme.spacing(1)} + 2px)`,
    top: theme.spacing(1),
    bottom: 0,
    width: '2px',
    backgroundColor: theme.colors.border.strong,
    zIndex: 1,
  }),
  suggestionsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    position: 'relative',
  }),
  timelineItem: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  }),
  timelineNode: css({
    position: 'absolute',
    left: theme.spacing(-4.5), // Position on the timeline line
    top: theme.spacing(1), // Align with card content
    width: theme.spacing(3),
    height: theme.spacing(3),
    borderRadius: theme.shape.radius.pill,
    border: `2px solid ${theme.colors.primary.main}`,
    backgroundColor: theme.colors.background.primary,
    zIndex: 2,
    flexShrink: 0,
  }),
  timelineNodeActive: css({
    backgroundColor: theme.colors.primary.main, // Filled circle for current/latest
    boxShadow: `0 0 0 4px ${theme.colors.background.primary}`, // White ring around filled circle
  }),
  timelineNodeInactive: css({
    backgroundColor: theme.colors.background.primary, // Empty circle for others
    boxShadow: `0 0 0 4px ${theme.colors.background.primary}`, // White ring around filled circle
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
    overflowX: 'auto',
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
    minWidth: '600px',
  }),
  codeHeader: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});
