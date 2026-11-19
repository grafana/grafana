import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { PanelStylesSection } from '../panel-edit/PanelStylesSection';
import { DashboardInteractions } from '../utils/interactions';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { QuickEditCard } from './QuickEditCard';
import { type QuickEdits, type ResolvedQuickEdit } from './useQuickEdits';

interface Props {
  panel: VizPanel;
  quickEdits: QuickEdits;
  /** The panel's element, which cards are placed beside. */
  getPanelElement: () => Element | null;
  /** The element holding the buttons, which cards treat as part of themselves. */
  bar: Element | null;
  /** Called as a card opens and closes, so the surface holding the buttons can stay put while one is open. */
  onCardOpenChange?: (open: boolean) => void;
  buttonClassName?: string;
}

/** One icon button per quick edit; a button opens its card, and pressing it again closes it. */
export function QuickEditButtons({
  panel,
  quickEdits,
  getPanelElement,
  bar,
  onCardOpenChange,
  buttonClassName,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { edits, applyPreset } = quickEdits;
  const open = edits.find((edit) => edit.quickEdit.id === openId);

  const close = useCallback(() => {
    setOpenId(null);
    onCardOpenChange?.(false);
  }, [onCardOpenChange]);

  const toggle = (edit: ResolvedQuickEdit) => {
    const next = openId === edit.quickEdit.id ? null : edit.quickEdit.id;
    setOpenId(next);
    onCardOpenChange?.(next !== null);
    if (next) {
      DashboardInteractions.panelQuickEditOpened({
        quick_edit: next,
        panel_type: panel.state.pluginId,
        panel_id: getPanelIdForVizPanel(panel),
      });
    }
  };

  return (
    <>
      {edits.map((edit) => (
        <QuickEditButton
          key={edit.quickEdit.id}
          edit={edit}
          active={open === edit}
          className={buttonClassName}
          onClick={() => toggle(edit)}
        />
      ))}
      {open && (
        <QuickEditCard
          title={open.quickEdit.title}
          icon={open.quickEdit.icon}
          panel={getPanelElement()}
          bar={bar}
          onClose={close}
        >
          {open.quickEdit.presets ? (
            <PanelStylesSection panel={panel} onApplyPreset={applyPreset} />
          ) : (
            <div>{open.items.map((item) => item.renderElement())}</div>
          )}
        </QuickEditCard>
      )}
    </>
  );
}

interface ButtonProps {
  edit: ResolvedQuickEdit;
  active: boolean;
  className?: string;
  onClick: () => void;
}

/** An icon with the quick edit's name and current value in its tooltip; colours show as swatches under it. */
function QuickEditButton({ edit, active, className, onClick }: ButtonProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { quickEdit, summary } = edit;
  const label = summary ? `${quickEdit.title}: ${summary.text}` : quickEdit.title;

  return (
    <Tooltip content={label} placement="top">
      <button
        type="button"
        className={cx(styles.button, className, active && styles.active)}
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
      >
        <Icon name={quickEdit.icon} />
        {summary?.swatches && (
          <span className={styles.swatches} aria-hidden>
            {summary.swatches.map((color, index) => (
              <span
                key={index}
                className={styles.swatch}
                style={{ background: theme.visualization.getColorByName(color) }}
              />
            ))}
          </span>
        )}
      </button>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Sized like the popover's other actions, so the popover keeps its height whichever set it shows.
  button: css({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 2,
      borderRadius: theme.shape.radius.default,
    },
  }),
  // Primary text can be neutral in a theme; the accent always marks the open card.
  active: css({
    color: theme.colors.accent.text,
  }),
  swatches: css({
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    gap: 1,
  }),
  swatch: css({
    width: 4,
    height: 4,
    borderRadius: theme.shape.radius.circle,
  }),
});
