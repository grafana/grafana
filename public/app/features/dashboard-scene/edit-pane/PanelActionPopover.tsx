import { css, cx, keyframes } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardEditPane } from './DashboardEditPane';
import { findPanelDomElement } from './PanelProcessingOverlay';

type PopoverMode = 'ai' | 'edit';

const AI_SUGGESTIONS = ['Analyse the spike', 'Summarise trends', 'Explain high values', 'Change series colors'];

// ---- Hover hint: small AI icon shown when hovering a panel ----

interface HoverHintProps {
  dashboard: DashboardScene;
  editPane: DashboardEditPane;
}

const PANEL_SECTION_SELECTOR = '[data-testid^="data-testid Panel header"]';
const HEADER_CONTAINER_SELECTOR = '[data-testid="data-testid header-container"]';

export function PanelHoverHint({ editPane }: HoverHintProps) {
  const styles = useStyles2(getHintStyles);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOver(e: MouseEvent) {
      const section = (e.target as HTMLElement).closest?.(PANEL_SECTION_SELECTOR);
      if (section instanceof HTMLElement && !section.classList.contains('dashboard-selected-element')) {
        const header = section.querySelector(HEADER_CONTAINER_SELECTOR);
        if (header instanceof HTMLElement) {
          setHeaderEl(header);
        }
      }
    }

    function handleOut(e: MouseEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related?.closest?.(PANEL_SECTION_SELECTOR)) {
        setHeaderEl(null);
      }
    }

    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseout', handleOut);
    return () => {
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseout', handleOut);
    };
  }, []);

  useEffect(() => {
    if (headerEl) {
      const section = headerEl.closest(PANEL_SECTION_SELECTOR);
      if (section?.classList.contains('dashboard-selected-element')) {
        setHeaderEl(null);
      }
    }
  }, [headerEl, editPane.state.selection]);

  useEffect(() => {
    if (!headerEl) {
      setPortalContainer((prev) => {
        prev?.remove();
        return null;
      });
      return;
    }

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    const menuBtn = headerEl.querySelector('[class*="panel-menu"]');
    if (menuBtn) {
      headerEl.insertBefore(container, menuBtn);
    } else {
      headerEl.appendChild(container);
    }
    setPortalContainer(container);

    return () => {
      container.remove();
      setPortalContainer(null);
    };
  }, [headerEl]);

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <div className={styles.hintIcon}>
      <Icon name="ai-sparkle" size="xs" />
    </div>,
    portalContainer
  );
}

// ---- Full popover: shown when a panel is selected (clicked) ----

interface Props {
  panel: VizPanel;
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

export function PanelActionPopover({ panel, editPane, dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const [mode, setMode] = useState<PopoverMode>(dashboard.state.isEditing ? 'edit' : 'ai');
  const [aiInput, setAiInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(panel.state.title ?? '');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = findPanelDomElement(panel.state.key!, dashboard);
    setAnchorEl(el);
  }, [panel, dashboard]);

  const { refs, floatingStyles, isPositioned } = useFloating({
    placement: 'bottom',
    middleware: [
      offset(8),
      shift({ padding: 8 }),
      flip({ fallbackAxisSideDirection: 'end' }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  });

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (mode === 'ai' && aiInputRef.current) {
      aiInputRef.current.focus();
    }
  }, [mode]);

  const ensureEditMode = useCallback(() => {
    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }
  }, [dashboard]);

  const handleTitleSubmit = useCallback(() => {
    ensureEditMode();
    panel.setState({ title: titleValue });
    setEditingTitle(false);
  }, [panel, titleValue, ensureEditMode]);

  const buildPanelContext = useCallback(() => {
    const panelKey = panel.state.key;
    const panelId = panelKey?.replace('panel-', '');
    return [
      createAssistantContextItem('structured', {
        data: {
          name: `Panel: ${panel.state.title || 'Untitled panel'}`,
          panelId,
          panelKey,
        },
      }),
      createAssistantContextItem('structured', {
        title: 'Panel edit instructions',
        hidden: true,
        data: {
          instructions:
            'The user is asking about a specific panel on their dashboard. ' +
            'Focus your changes on this panel only. Do NOT navigate away from this dashboard.',
        },
      }),
    ];
  }, [panel]);

  const handleAiSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const prompt = aiInput.trim();
      if (!prompt) {
        return;
      }
      const panelKey = panel.state.key;
      editPane.openAssistantPane(prompt, buildPanelContext(), panelKey ? [panelKey] : undefined);
      setAiInput('');
    },
    [aiInput, editPane, buildPanelContext, panel]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      const panelKey = panel.state.key;
      editPane.openAssistantPane(suggestion, buildPanelContext(), panelKey ? [panelKey] : undefined);
    },
    [editPane, buildPanelContext, panel]
  );

  const handleClose = useCallback(() => {
    editPane.clearSelection();
  }, [editPane]);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!anchorEl || !isPositioned) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [anchorEl, isPositioned]);

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        zIndex: 1000,
        visibility: visible ? 'visible' : 'hidden',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className={visible ? styles.wrapper : undefined}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="ai-sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7B61FF" />
            <stop offset="50%" stopColor="#D55FDE" />
            <stop offset="100%" stopColor="#FF8A65" />
          </linearGradient>
        </defs>
      </svg>
      <div className={cx(styles.card, mode === 'ai' && styles.cardWithInput)}>
        <div className={styles.toolbar}>
          <div className={styles.modeToggle}>
            {dashboard.state.isEditing ? (
              <button
                className={cx(styles.modeBtn, mode === 'ai' ? styles.modeBtnAiActive : styles.modeBtnAiInactive)}
                onClick={() => setMode('ai')}
                aria-label="AI mode"
              >
                <Icon name="ai-sparkle" size="md" />
              </button>
            ) : (
              <div className={cx(styles.modeBtn, styles.modeBtnAiActive)} aria-label="AI mode">
                <Icon name="ai-sparkle" size="md" />
              </div>
            )}
            {dashboard.state.isEditing && (
              <button
                className={cx(styles.modeBtn, mode === 'edit' && styles.modeBtnEditActive)}
                onClick={() => setMode('edit')}
                aria-label="Edit mode"
              >
                <Icon name="pen" size="md" />
              </button>
            )}
          </div>

          {/* AI mode: suggestion pills */}
          {mode === 'ai' && (
            <div className={styles.pills}>
              {AI_SUGGESTIONS.map((s) => (
                <button key={s} className={styles.pill} onClick={() => handleSuggestionClick(s)}>
                  <Icon name="ai-sparkle" size="xs" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Edit mode: action buttons */}
          {mode === 'edit' && (
            <div className={styles.actions}>
              <button className={styles.actionBtn} aria-label="Panel options" title="Panel options">
                <Icon name="clipboard-alt" size="lg" />
              </button>
              <button
                className={styles.actionBtn}
                aria-label="Edit title"
                title="Edit title"
                onClick={() => {
                  setTitleValue(panel.state.title ?? '');
                  setEditingTitle(true);
                }}
              >
                <span className={styles.actionLetter}>T</span>
              </button>
              <button className={styles.actionBtn} aria-label="Move panel" title="Move panel">
                <Icon name="corner-down-right-alt" size="lg" />
              </button>
              <button className={styles.actionBtn} aria-label="Change colors" title="Change colors">
                <Icon name="palette" size="lg" />
              </button>
            </div>
          )}

          {/* Close button */}
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            <Icon name="times" size="lg" />
          </button>
        </div>

        {/* AI input row */}
        {mode === 'ai' && (
          <form onSubmit={handleAiSubmit} className={styles.inputRow}>
            <Icon name="ai-sparkle" size="md" className={styles.inputIcon} />
            <input
              ref={aiInputRef}
              className={styles.input}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask AI to change this panel..."
            />
          </form>
        )}

        {/* Title edit row */}
        {editingTitle && mode === 'edit' && (
          <div className={styles.inputRow}>
            <Icon name="text-fields" size="md" className={styles.inputIcon} />
            <input
              ref={titleInputRef}
              className={styles.input}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="Panel title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTitleSubmit();
                }
                if (e.key === 'Escape') {
                  setEditingTitle(false);
                }
              }}
              onBlur={handleTitleSubmit}
            />
          </div>
        )}
      </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Animations ----

const gradientFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const popoverEnter = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
`;

const hintEnter = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

const GLOW_GRADIENT =
  'linear-gradient(45deg, oklab(0.87 -0.01 0.21), oklab(0.73 0.13 0.17), oklab(0.65 0.2 0.14), oklab(0.64 0.28 0.01), oklab(0.65 0.27 -0.16), oklab(0.49 0.04 -0.3), oklab(0.54 0.12 -0.28))';

function getGlowShadow(theme: GrafanaTheme2) {
  const baseShadow = theme.isDark ? 'rgb(17 18 23)' : 'rgb(245 245 245)';
  return [
    'rgba(168, 85, 247, 0.25) 3px -1px 20px',
    'rgba(249, 115, 22, 0.18) -5px 3px 40px',
    'rgba(168, 85, 247, 0.12) 7px 4px 60px',
    'rgba(249, 115, 22, 0.06) -6px -6px 80px',
    'rgba(168, 85, 247, 0.12) -1px 7px 100px',
    'rgba(249, 115, 22, 0.04) -5px 0px 120px',
    `${baseShadow} 1px 0px 20px`,
  ].join(', ');
}

// ---- Hover hint styles ----

function getHintStyles(theme: GrafanaTheme2) {
  return {
    hintIcon: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: '50%',
      background:
        'linear-gradient(135deg, oklab(0.49 0.04 -0.3), oklab(0.65 0.27 -0.16), oklab(0.73 0.13 0.17))',
      color: '#fff',
      boxShadow: 'rgba(168, 85, 247, 0.5) 0 0 6px',
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${hintEnter} 0.2s cubic-bezier(0.16, 1, 0.3, 1)`,
      },
    }),
  };
}

// ---- Popover styles ----

function getStyles(theme: GrafanaTheme2) {
  const elevatedBg = theme.colors.background.elevated;
  const glowShadow = getGlowShadow(theme);

  const aiGradient =
    'linear-gradient(135deg, oklab(0.49 0.04 -0.3), oklab(0.65 0.27 -0.16), oklab(0.64 0.28 0.01), oklab(0.65 0.2 0.14), oklab(0.73 0.13 0.17), oklab(0.49 0.04 -0.3))';

  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      transformOrigin: 'top center',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${popoverEnter} 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)`,
      },
    }),
    card: css({
      borderRadius: theme.shape.radius.pill,
      border: '2px solid transparent',
      background: `linear-gradient(${elevatedBg}, ${elevatedBg}) padding-box, ${GLOW_GRADIENT} border-box`,
      boxShadow: glowShadow,
      overflow: 'hidden',
    }),
    cardWithInput: css({
      borderRadius: 24,
    }),
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5),
    }),

    // -- Mode toggle --
    modeToggle: css({
      display: 'flex',
      borderRadius: theme.shape.radius.pill,
      overflow: 'hidden',
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.medium}`,
      flexShrink: 0,
      padding: 2,
      gap: 2,
    }),
    modeBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 32,
      border: 'none',
      cursor: 'pointer',
      background: 'transparent',
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.pill,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.2s ease',
      },
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
    }),
    modeBtnAiInactive: css({
      background: 'transparent',
      '& svg': {
        fill: 'url(#ai-sparkle-gradient)',
      },
      '&::before': {
        content: '""',
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
      },
    }),
    modeBtnAiActive: css({
      color: '#fff',
      background: aiGradient,
      backgroundSize: '300% 300%',
      boxShadow: '0 0 12px rgba(160, 80, 255, 0.5), 0 0 4px rgba(255, 100, 200, 0.3)',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${gradientFlow} 4s ease infinite`,
      },
      '&:hover': {
        color: '#fff',
        background: aiGradient,
        backgroundSize: '300% 300%',
        boxShadow: '0 0 16px rgba(160, 80, 255, 0.65), 0 0 6px rgba(255, 100, 200, 0.4)',
      },
    }),
    modeBtnEditActive: css({
      color: theme.colors.text.maxContrast,
      background: theme.colors.background.secondary,
      boxShadow: theme.shadows.z1,
    }),

    // -- AI suggestion pills --
    pills: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flex: 1,
      overflow: 'hidden',
    }),
    pill: css({
      ...theme.typography.bodySmall,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.15s ease',
      },
      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
        borderColor: theme.colors.border.medium,
      },
    }),

    // -- Edit action buttons --
    actions: css({
      display: 'flex',
      gap: theme.spacing(1),
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }),
    actionBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      border: 'none',
      cursor: 'pointer',
      background: 'transparent',
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.default,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.15s ease',
      },
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
    }),
    actionLetter: css({
      fontSize: 20,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1,
    }),

    // -- Close --
    closeBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      border: 'none',
      cursor: 'pointer',
      background: 'transparent',
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.default,
      flexShrink: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'color 0.15s ease',
      },
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),

    // -- Shared input row --
    inputRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    inputIcon: css({
      color: theme.colors.text.disabled,
      flexShrink: 0,
    }),
    input: css({
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      ...theme.typography.body,
      color: theme.colors.text.primary,
      padding: `${theme.spacing(0.5)} 0`,
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
    }),
  };
}
