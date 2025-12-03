import { css } from '@emotion/css';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { usePanelDataPaneColors } from './theme';

interface ContextPill {
  id: string;
  label: string;
  type: 'query' | 'transform' | 'expression';
  icon: IconName;
}

interface AiModeCardProps {
  selectedContexts: ContextPill[];
  onRemoveContext: (id: string) => void;
  onSubmit: (prompt: string) => void;
  onDemoWorkflow?: {
    availableCardIds: string[];
    onSelectContext: (id: string) => void;
    onAddOrganizeFieldsTransformation: () => void;
    onCloseAiMode: () => void;
  };
}

export const AiModeCard = ({ selectedContexts, onRemoveContext, onSubmit, onDemoWorkflow }: AiModeCardProps) => {
  const colors = usePanelDataPaneColors();
  const styles = useStyles2(getStyles, colors);
  const [prompt, setPrompt] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [isRunningDemo, setIsRunningDemo] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.textContent || '';
      setPrompt(content);

      // Clear the innerHTML if there's no actual text content to show the placeholder
      if (!content.trim()) {
        editorRef.current.innerHTML = '';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim()) {
        handleSubmit(e);
      }
    }
  };

  // Demo workflow effect - only runs if URL has ?aiDemo=true
  useEffect(() => {
    if (!onDemoWorkflow || isRunningDemo || onDemoWorkflow.availableCardIds.length === 0) {
      return;
    }

    // Check for demo URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoEnabled = urlParams.get('aiDemo') === 'true';

    if (!isDemoEnabled) {
      return;
    }

    setIsRunningDemo(true);

    const runDemoWorkflow = async () => {
      // Wait a bit before starting
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 1: Select random cards (1-3)
      const numCards = Math.min(
        Math.floor(Math.random() * 3) + 1, // Random 1-3
        onDemoWorkflow.availableCardIds.length
      );

      const shuffled = [...onDemoWorkflow.availableCardIds].sort(() => Math.random() - 0.5);
      const cardsToSelect = shuffled.slice(0, numCards);

      for (const cardId of cardsToSelect) {
        onDemoWorkflow.onSelectContext(cardId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Wait a bit after selecting cards
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 2: Type the message character by character
      const message = "I'd like to auto-organize my fields by name in ascending order!";
      for (let i = 0; i <= message.length; i++) {
        const partial = message.slice(0, i);
        setPrompt(partial);
        if (editorRef.current) {
          editorRef.current.textContent = partial;
        }
        await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 40)); // Vary speed
      }

      // Wait a bit before submitting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Submit and clear input
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
      setPrompt('');

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Find the transformations section or last transform card to scroll to first
      const transformCards = document.querySelectorAll('[data-card-id^="transform-"]');
      const transformSection = document.querySelector('[data-testid="query-transform-list-content"]');

      if (transformCards.length > 0) {
        // Scroll to the last transform card
        const lastTransform = transformCards[transformCards.length - 1];
        lastTransform.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (transformSection) {
        // If no transforms yet, scroll to bottom of the section
        transformSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }

      // Wait for scroll to complete, then add the transformation
      await new Promise((resolve) => setTimeout(resolve, 800));
      onDemoWorkflow.onAddOrganizeFieldsTransformation();

      // Wait a moment to show the new transformation, then close AI mode
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onDemoWorkflow.onCloseAiMode();
    };

    runDemoWorkflow();
  }, [onDemoWorkflow, isRunningDemo]);

  const hasContext = selectedContexts.length > 0;

  return (
    <div className={styles.container}>
      {/* Context Pills Section */}
      {hasContext && (
        <div className={styles.contextSection}>
          <Stack direction="row" gap={1} wrap="wrap">
            {selectedContexts.map((context) => (
              <div key={context.id} className={styles.badge} style={styles.getBadgeStyle(context.type)}>
                <Icon name={context.icon} size="sm" style={styles.getBadgeColor(context.type)} />
                <span className={styles.badgeLabel} style={styles.getBadgeColor(context.type)}>
                  {context.label}
                </span>
                <button
                  className={styles.badgeRemove}
                  style={styles.getBadgeColor(context.type)}
                  onClick={() => onRemoveContext(context.id)}
                  aria-label={t('dashboard-scene.ai-mode-card.remove-context', 'Remove context')}
                >
                  ×
                </button>
              </div>
            ))}
          </Stack>
        </div>
      )}

      {/* Prompt Input Section */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div
          ref={editorRef}
          className={styles.input}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={t('dashboard-scene.ai-mode-card.prompt-placeholder', 'Describe what you want to do...')}
          role="textbox"
          aria-multiline="true"
          aria-label={t('dashboard-scene.ai-mode-card.aria-label', 'AI prompt input')}
          tabIndex={0}
        />

        <div className={styles.bottomRow}>
          <div className={styles.leftContent}>
            {!hasContext && (
              <div className={styles.emptyState}>
                <Icon name="ai-pointer" />
                {t('dashboard-scene.ai-mode-card.add-nodes-to-context', 'Add nodes to context')}
              </div>
            )}
          </div>
          <IconButton
            name="message"
            type="submit"
            disabled={!prompt.trim()}
            tooltip={t('dashboard-scene.ai-mode-card.submit', 'Send message')}
            className={styles.submitButton}
          />
        </div>
      </form>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, colors: ReturnType<typeof usePanelDataPaneColors>) => {
  const getColorForType = (type: 'query' | 'transform' | 'expression') => {
    switch (type) {
      case 'query':
        return colors.query.accent;
      case 'expression':
        return colors.expression.accent;
      case 'transform':
        return colors.transform.accent;
    }
  };

  return {
    container: css({
      background: theme.colors.background.primary,
      border: 'none',
      borderRadius: 'unset',
      padding: `0 0 ${theme.spacing(1)} 0`,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }),
    contextSection: css({
      marginBottom: theme.spacing(2),
      padding: `0 ${theme.spacing(1.5)}`,
    }),
    badge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      border: 'none',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 1.5),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    getBadgeStyle: (type: 'query' | 'transform' | 'expression') => ({
      background: `${getColorForType(type)}26`, // 26 in hex = ~15% opacity
    }),
    badgeLabel: css({}),
    getBadgeColor: (type: 'query' | 'transform' | 'expression') => ({
      color: getColorForType(type),
    }),
    badgeRemove: css({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      marginLeft: theme.spacing(0.5),
      fontSize: '16px',
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.7,
      '&:hover': {
        opacity: 1,
      },
    }),
    form: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      width: '100%',
      minWidth: 0,
    }),
    input: css({
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      maxHeight: theme.spacing(38),
      minHeight: theme.spacing(4),
      height: 'auto',
      overflow: 'auto',
      padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
      border: 'none',
      background: 'transparent',
      whiteSpace: 'pre-wrap',
      outline: 'none',
      wordBreak: 'break-word',
      fontSize: '14px',
      lineHeight: 1.5,
      fontFamily: theme.typography.fontFamily,
      color: theme.colors.text.primary,

      '&::-webkit-scrollbar': {
        width: '4px',
        height: '4px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme.colors.border.weak,
        borderRadius: theme.shape.radius.default,
        '&:hover': {
          background: theme.colors.border.strong,
        },
      },
      '&::-webkit-scrollbar-corner': {
        background: 'transparent',
      },
      scrollbarWidth: 'thin',
      scrollbarColor: `${theme.colors.border.weak} transparent`,

      '&:empty:before': {
        content: 'attr(data-placeholder)',
        color: theme.colors.text.disabled,
        pointerEvents: 'none',
        display: 'block',
      },

      '&:focus:empty:before': {
        color: theme.colors.text.secondary,
      },
    }),
    bottomRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: `0 ${theme.spacing(1.5)}`,
    }),
    leftContent: css({
      flex: 1,
    }),
    emptyState: css({
      fontSize: theme.typography.fontSize - 2,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontFamily: theme.typography.fontFamilyMonospace,
      letterSpacing: '0.05em',
    }),
    submitButton: css({
      flexShrink: 0,
    }),
  };
};
