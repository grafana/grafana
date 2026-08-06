import { css, cx, keyframes } from '@emotion/css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { AssistantDifyMessage as AssistantMessageType, useAssistantDifyContext } from './AssistantDifyContext';
import { sendDifyChatMessage, transcribeAudioWithDify } from './difyClient';
import { DifyVoiceRecorder, formatTranscriptionError } from './voiceRecorder';

export const ASSISTANT_DIFY_SIDEBAR_WIDTH = 380;

const SUGGESTED_QUESTIONS = [
  'What can you help me with?',
  'How do I create a dashboard?',
  'How do I set up alerting?',
  'What data sources does Grafana support?',
  'How do I write a PromQL query?',
];

export function AssistantDifyPanel() {
  const styles = useStyles2(getStyles);
  const {
    isOpen,
    closeAssistant,
    messages,
    addMessage,
    clearMessages,
    setMessageFeedback,
    isTyping,
    setIsTyping,
    conversationId,
    setConversationId,
    userId,
  } = useAssistantDifyContext();
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceRecorderRef = useRef<DifyVoiceRecorder | null>(null);
  const isStoppingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      voiceRecorderRef.current?.cancel();
      voiceRecorderRef.current = null;
    };
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const message = (text ?? inputValue).trim();
      if (!message || isTyping) {
        return;
      }

      addMessage('user', message);
      setInputValue('');
      setIsTyping(true);
      setVoiceStatus('');

      try {
        const result = await sendDifyChatMessage(message, conversationId, userId);
        if (result.conversationId) {
          setConversationId(result.conversationId);
        }
        addMessage('assistant', result.answer);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addMessage(
          'assistant',
          t(
            'assistant-dify.errors.unreachable',
            'Sorry — I could not reach Dify.\n\n{{error}}\n\nMake sure the Dify proxy is running (`node scripts/assistant-dify-proxy.mjs`) and `DIFY_API_KEY` is set in `.dify.env`.',
            { error: errMsg }
          )
        );
      } finally {
        setIsTyping(false);
      }
    },
    [inputValue, isTyping, addMessage, setIsTyping, conversationId, setConversationId, userId]
  );

  const finishRecording = useCallback(async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;
    setIsRecording(false);
    setIsTranscribing(true);

    const recorder = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    if (!recorder) {
      isStoppingRef.current = false;
      return;
    }

    setVoiceStatus(t('assistant-dify.voice.transcribing', 'Transcribing speech…'));

    try {
      const result = await recorder.stop();

      if (result.text?.trim()) {
        setVoiceStatus('');
        await handleSend(result.text.trim());
        return;
      }

      if (!result.audio) {
        setVoiceStatus(
          t(
            'assistant-dify.voice.no-speech',
            'No speech detected. Use Chrome for voice, or type your question.'
          )
        );
        return;
      }

      setVoiceStatus(t('assistant-dify.voice.transcribing-dify', 'Sending audio to Dify speech-to-text…'));
      const text = await transcribeAudioWithDify(result.audio, userId);
      setVoiceStatus('');
      if (text.trim()) {
        await handleSend(text.trim());
      } else {
        setVoiceStatus(t('assistant-dify.voice.empty', 'No speech detected.'));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setVoiceStatus(
        t('assistant-dify.voice.transcription-failed', 'Transcription failed: {{error}}', {
          error: formatTranscriptionError(errMsg),
        })
      );
    } finally {
      setIsTranscribing(false);
      isStoppingRef.current = false;
    }
  }, [handleSend, userId]);

  const startRecording = useCallback(async () => {
    if (isTyping || isRecording || isStoppingRef.current) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus(t('assistant-dify.voice.unsupported', 'Voice input is not supported in this browser.'));
      return;
    }

    try {
      const recorder = new DifyVoiceRecorder();
      voiceRecorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setVoiceStatus(
        recorder.usesBrowserSpeech
          ? t('assistant-dify.voice.recording-browser', 'Recording… click send when done')
          : t('assistant-dify.voice.recording-dify', 'Recording… click send (uses Dify speech-to-text)')
      );
    } catch {
      voiceRecorderRef.current?.cancel();
      voiceRecorderRef.current = null;
      setVoiceStatus(t('assistant-dify.voice.permission-denied', 'Microphone permission denied.'));
      setIsRecording(false);
    }
  }, [isRecording, isTyping]);

  const cancelRecording = useCallback(() => {
    voiceRecorderRef.current?.cancel();
    voiceRecorderRef.current = null;
    setIsRecording(false);
    setVoiceStatus('');
  }, []);

  const toggleVoice = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, cancelRecording]);

  const handlePrimaryAction = useCallback(() => {
    if (isRecording) {
      void finishRecording();
      return;
    }
    void handleSend();
  }, [isRecording, finishRecording, handleSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInputChange = (e: FormEvent<HTMLTextAreaElement>) => {
    setInputValue(e.currentTarget.value);
  };

  if (!isOpen) {
    return null;
  }

  const showWelcome = messages.length === 0;

  return (
    <div
      className={styles.panel}
      role="complementary"
      aria-label={t('assistant-dify.panel.aria-label', 'Grafana Assistant (Dify)')}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Icon name="ai-sparkle" size="lg" className={styles.headerIcon} />
          <span className={styles.headerTitle}>
            <Trans i18nKey="assistant-dify.header.title">Grafana Assistant</Trans>
          </span>
          <span className={styles.badge}>
            <Trans i18nKey="assistant-dify.header.badge">Dify</Trans>
          </span>
        </div>
        <div className={styles.headerActions}>
          <IconButton
            name="trash-alt"
            size="md"
            tooltip={t('assistant-dify.actions.clear', 'Clear conversation')}
            onClick={clearMessages}
            aria-label={t('assistant-dify.actions.clear', 'Clear conversation')}
          />
          <IconButton
            name="times"
            size="lg"
            tooltip={t('assistant-dify.actions.close', 'Close assistant')}
            onClick={closeAssistant}
            aria-label={t('assistant-dify.actions.close', 'Close assistant')}
          />
        </div>
      </div>

      <div className={styles.messagesArea}>
        {showWelcome && <WelcomeScreen onQuestionClick={(q) => void handleSend(q)} />}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onFeedback={setMessageFeedback} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder={t('assistant-dify.input.placeholder', 'Ask with text or voice…')}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isTyping || isRecording || isTranscribing}
          />
          <button
            className={cx(styles.micButton, { [styles.micButtonActive]: isRecording })}
            onClick={toggleVoice}
            disabled={isTyping || isTranscribing}
            aria-label={t('assistant-dify.actions.voice', 'Voice input')}
            type="button"
          >
            <Icon name={isRecording ? 'microphone-slash' : 'microphone'} size="md" />
          </button>
          <button
            className={cx(styles.sendButton, {
              [styles.sendButtonActive]:
                (isRecording || inputValue.trim().length > 0) && !isTyping && !isTranscribing,
            })}
            onClick={() => void handlePrimaryAction()}
            disabled={(!isRecording && !inputValue.trim()) || isTyping || isTranscribing}
            aria-label={
              isRecording
                ? t('assistant-dify.actions.send-voice', 'Transcribe and send')
                : t('assistant-dify.actions.send', 'Send message')
            }
            type="button"
          >
            <Icon name="arrow-up" size="md" />
          </button>
        </div>
        <div className={styles.inputHint}>
          {voiceStatus ? (
            <span className={styles.voiceStatus}>{voiceStatus}</span>
          ) : (
            <Trans i18nKey="assistant-dify.input.hint">
              Click mic to record, then send · or type and press <kbd>Enter</kbd>
            </Trans>
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onQuestionClick }: { onQuestionClick: (q: string) => void }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeIconWrapper}>
        <Icon name="ai-sparkle" size="xxxl" className={styles.welcomeIcon} />
      </div>
      <h2 className={styles.welcomeTitle}>
        <Trans i18nKey="assistant-dify.welcome.title">Grafana Assistant</Trans>
      </h2>
      <p className={styles.welcomeSubtitle}>
        <Trans i18nKey="assistant-dify.welcome.subtitle">
          Same UI as before — powered by Dify for chat and speech-to-text.
        </Trans>
      </p>
      <div className={styles.suggestionsGrid}>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} className={styles.suggestionCard} onClick={() => onQuestionClick(q)} type="button">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onFeedback,
}: {
  message: AssistantMessageType;
  onFeedback: (id: string, fb: 'up' | 'down') => void;
}) {
  const styles = useStyles2(getStyles);
  const isUser = message.role === 'user';

  return (
    <div className={cx(styles.messageBubbleRow, { [styles.messageBubbleRowUser]: isUser })}>
      {!isUser && (
        <div className={styles.avatarAssistant}>
          <Icon name="ai-sparkle" size="sm" />
        </div>
      )}
      <div className={cx(styles.messageBubble, { [styles.messageBubbleUser]: isUser })}>
        <div className={styles.messageContent}>{renderMarkdownLite(message.content)}</div>
        {!isUser && (
          <div className={styles.feedbackRow}>
            <IconButton
              name="thumbs-up"
              size="sm"
              tooltip={t('assistant-dify.feedback.helpful', 'Helpful')}
              onClick={() => onFeedback(message.id, 'up')}
              className={cx({ [styles.feedbackActive]: message.feedback === 'up' })}
              aria-label={t('assistant-dify.feedback.helpful', 'Helpful')}
            />
            <IconButton
              name="thumbs-down"
              size="sm"
              tooltip={t('assistant-dify.feedback.not-helpful', 'Not helpful')}
              onClick={() => onFeedback(message.id, 'down')}
              className={cx({ [styles.feedbackActive]: message.feedback === 'down' })}
              aria-label={t('assistant-dify.feedback.not-helpful', 'Not helpful')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarkdownLite(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    let processed: React.ReactNode = line;

    if (line.includes('**')) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      processed = parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part));
    }

    if (typeof processed === 'string' && processed.includes('`')) {
      const parts = processed.split(/`(.*?)`/g);
      processed = parts.map((part, j) => (j % 2 === 1 ? <code key={j}>{part}</code> : part));
    }

    if (line.startsWith('- ')) {
      return (
        <div key={i} style={{ paddingLeft: 12, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0 }}>•</span>
          {typeof processed === 'string' ? processed.slice(2) : processed}
        </div>
      );
    }

    const numberedMatch = line.match(/^(\d+)\.\s/);
    if (numberedMatch) {
      return (
        <div key={i} style={{ paddingLeft: 16, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0 }}>{numberedMatch[1]}.</span>
          {typeof processed === 'string' ? processed.slice(numberedMatch[0].length) : processed}
        </div>
      );
    }

    return (
      <span key={i}>
        {processed}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

function TypingIndicator() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.messageBubbleRow}>
      <div className={styles.avatarAssistant}>
        <Icon name="ai-sparkle" size="sm" />
      </div>
      <div className={styles.typingBubble}>
        <span className={styles.typingDot} />
        <span className={cx(styles.typingDot, styles.typingDotDelay1)} />
        <span className={cx(styles.typingDot, styles.typingDotDelay2)} />
      </div>
    </div>
  );
}

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
`;

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: ASSISTANT_DIFY_SIDEBAR_WIDTH,
    backgroundColor: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.primary,
    minHeight: 48,
  }),
  headerLeft: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  headerIcon: css({
    color: theme.colors.warning.text,
  }),
  headerTitle: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  badge: css({
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.primary.contrastText,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.shape.radius.pill,
    padding: theme.spacing(0.25, 0.75),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  }),
  headerActions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  messagesArea: css({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  welcome: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: theme.spacing(3, 1),
    gap: theme.spacing(1.5),
  }),
  welcomeIconWrapper: css({
    width: 64,
    height: 64,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.gradients.brandVertical,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1),
  }),
  welcomeIcon: css({
    color: theme.colors.text.maxContrast,
  }),
  welcomeTitle: css({
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    margin: 0,
  }),
  welcomeSubtitle: css({
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    margin: 0,
    lineHeight: 1.5,
  }),
  suggestionsGrid: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: '100%',
    marginTop: theme.spacing(1),
  }),
  suggestionCard: css({
    display: 'block',
    width: '100%',
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'left',
    cursor: 'pointer',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.15s ease',
    },
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
      borderColor: theme.colors.primary.border,
    },
  }),
  messageBubbleRow: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
  }),
  messageBubbleRowUser: css({
    flexDirection: 'row-reverse',
  }),
  avatarAssistant: css({
    width: 28,
    height: 28,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.gradients.brandVertical,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: theme.colors.text.maxContrast,
    marginTop: 2,
  }),
  messageBubble: css({
    maxWidth: '85%',
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    borderTopLeftRadius: theme.spacing(0.5),
    code: {
      backgroundColor: theme.colors.action.hover,
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      fontSize: '0.85em',
      fontFamily: theme.typography.fontFamilyMonospace,
    },
  }),
  messageBubbleUser: css({
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    borderTopLeftRadius: theme.spacing(2),
    borderTopRightRadius: theme.spacing(0.5),
  }),
  messageContent: css({
    wordBreak: 'break-word',
  }),
  feedbackRow: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
    opacity: 0.6,
    '&:hover': {
      opacity: 1,
    },
  }),
  feedbackActive: css({
    color: theme.colors.primary.text,
    opacity: 1,
  }),
  typingBubble: css({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderTopLeftRadius: theme.spacing(0.5),
  }),
  typingDot: css({
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.text.secondary,
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${bounce} 1.2s infinite`,
    },
  }),
  typingDotDelay1: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animationDelay: '0.2s',
    },
  }),
  typingDotDelay2: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animationDelay: '0.4s',
    },
  }),
  inputArea: css({
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.primary,
  }),
  inputWrapper: css({
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.spacing(2.5),
    padding: theme.spacing(0.75, 1),
    backgroundColor: theme.colors.background.secondary,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'border-color 0.15s ease',
    },
    '&:focus-within': {
      borderColor: theme.colors.primary.border,
    },
  }),
  input: css({
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    resize: 'none',
    padding: theme.spacing(0.5, 0),
    lineHeight: 1.5,
    fontFamily: theme.typography.fontFamily,
    maxHeight: 120,
    '&::placeholder': {
      color: theme.colors.text.disabled,
    },
  }),
  micButton: css({
    width: 32,
    height: 32,
    borderRadius: theme.shape.radius.circle,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.15s ease',
    },
    '&:hover': {
      color: theme.colors.primary.text,
      backgroundColor: theme.colors.action.hover,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  }),
  micButtonActive: css({
    color: theme.colors.error.text,
    backgroundColor: theme.colors.error.transparent,
    '&:hover': {
      color: theme.colors.error.text,
      backgroundColor: theme.colors.error.transparent,
    },
  }),
  sendButton: css({
    width: 32,
    height: 32,
    borderRadius: theme.shape.radius.circle,
    border: 'none',
    backgroundColor: theme.colors.text.disabled,
    color: theme.colors.background.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'not-allowed',
    flexShrink: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.15s ease',
    },
  }),
  sendButtonActive: css({
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
    },
  }),
  inputHint: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    textAlign: 'center',
    marginTop: theme.spacing(0.5),
    kbd: {
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
      fontSize: '0.85em',
    },
  }),
  voiceStatus: css({
    color: theme.colors.warning.text,
  }),
});
