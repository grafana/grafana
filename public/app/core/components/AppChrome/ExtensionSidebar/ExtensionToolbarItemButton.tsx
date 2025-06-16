import { css, cx, keyframes } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

interface ToolbarItemButtonProps {
  isOpen: boolean;
  title?: string;
  onClick?: () => void;
}

function ExtensionToolbarItemButtonComponent(
  { isOpen, title, onClick }: ToolbarItemButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  const styles = useStyles2(getStyles);
  const [hasBeenOpened, setHasBeenOpened] = useState(() => {
    const stored = localStorage.getItem('extension-sidebar-has-been-opened');
    return stored === 'true';
  });

  useEffect(() => {
    if (isOpen) {
      setHasBeenOpened(true);
      localStorage.setItem('extension-sidebar-has-been-opened', 'true');
    }
  }, [isOpen]);

  if (isOpen) {
    return (
      <ToolbarButton
        ref={ref}
        className={cx(styles.button, styles.buttonActive)}
        icon="ai-sparkle"
        id="extension-toolbar-button-ai-sparkle-close"
        data-testid="extension-toolbar-button-close"
        variant="default"
        onClick={onClick}
        tooltip={t('navigation.extension-sidebar.button-tooltip.close', 'Close {{title}}', { title })}
      />
    );
  }

  let tooltip = t('navigation.extension-sidebar.button-tooltip.open-all', 'Open AI assistants and sidebar apps');
  if (title) {
    tooltip = t('navigation.extension-sidebar.button-tooltip.open', 'Open {{title}}', { title });
  }

  return (
    <div className={styles.buttonWrapper}>
      <ToolbarButton
        ref={ref}
        className={cx(styles.button)}
        icon="ai-sparkle"
        id="extension-toolbar-button-ai-sparkle-open"
        data-testid="extension-toolbar-button-open"
        variant="default"
        onClick={onClick}
        tooltip={tooltip}
      />
      {!hasBeenOpened && (
        <>
          <Sparkle delay={0.2} position="top" />
          <Sparkle delay={0.7} position="bottom-right" />
          <Sparkle delay={1.2} position="bottom-left" />
        </>
      )}
    </div>
  );
}

export const ExtensionToolbarItemButton = React.forwardRef<HTMLButtonElement, ToolbarItemButtonProps>(
  ExtensionToolbarItemButtonComponent
);

function getStyles(theme: GrafanaTheme2) {
  return {
    buttonWrapper: css({
      position: 'relative',
      display: 'inline-block',
    }),
    button: css({
      aspectRatio: '1 / 1 !important',
      width: '28px',
      height: '28px',
      padding: 0,
      justifyContent: 'center',
      borderRadius: theme.shape.radius.circle,
      margin: theme.spacing(0, 0.25),
    }),
    buttonActive: css({
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.primary.transparent,
      border: `1px solid ${theme.colors.primary.borderTransparent}`,
      color: theme.colors.text.primary,
    }),
  };
}

const sparkleAnimation = keyframes`
  0% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
  100% { opacity: 0; transform: scale(0) rotate(360deg); }
`;

interface SparkleProps {
  delay: number;
  position: 'top' | 'bottom-right' | 'bottom-left';
}

const Sparkle = ({ delay, position }: SparkleProps) => {
  const styles = useStyles2(getSparkleStyles);
  return (
    <span className={cx(styles.sparkle, styles[position])} style={{ animationDelay: `${delay}s` }}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path d="M10 2 L11.5 8.5 L18 10 L11.5 11.5 L10 18 L8.5 11.5 L2 10 L8.5 8.5 Z" fill="currentColor"/>
        </g>
      </svg>
    </span>
  );
};

function getSparkleStyles() {
  return {
    sparkle: css({
      position: 'absolute',
      color: '#FFD700',
      opacity: 0,
      '@media (prefers-reduced-motion: no-preference)': {
        animation: `${sparkleAnimation} 2s infinite`,
      },
      pointerEvents: 'none',
      zIndex: 0,
    }),
    top: css({
      top: '-10px',
      left: '40%',
      transform: 'translateX(-50%)',
    }),
    'bottom-right': css({
      bottom: '-4px',
      right: '-4px',
    }),
    'bottom-left': css({
      bottom: '0',
      left: '-4px',
    }),
  };
}
