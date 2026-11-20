import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaPanelQuickEdits } from '@grafana/runtime/internal';
import { type VizPanel } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { QuickEditButtons } from '../../quick-edits/QuickEditButtons';
import { usePanelQuickEditsView } from '../../quick-edits/panelQuickEditsView';
import { useQuickEdits } from '../../quick-edits/useQuickEdits';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';

import { getActionStyles } from './EditActions';
import { useEditActionsPopover } from './EditActionsPopover';

/**
 * Whether the panel's actions lead with quick edits. A repeat clone takes its options from the source panel, so only
 * the source offers them.
 */
export function useOffersQuickEdits(panel: VizPanel): boolean {
  const isQuickEditsEnabled = useFlagGrafanaPanelQuickEdits();
  return isQuickEditsEnabled && !isRepeatCloneOrChildOf(panel) && Boolean(panel.getPlugin()?.getQuickEdits().length);
}

/** The padding and gap of each popover the quick edits swap into, in theme spacing units. */
const BAR_SPACING = {
  'edit-actions': { paddingY: 0.5, gap: 0.75 },
  'panel-actions': { paddingY: 1, gap: 1 },
};

interface Props {
  panel: VizPanel;
  /** The popover holding the actions, whose spacing the quick edits match so the bar keeps its height. */
  spacing?: keyof typeof BAR_SPACING;
  children: ReactNode;
}

/**
 * The panel's actions, with a bolt first that swaps them for the panel's quick edits. The quick edits slide in over
 * the actions from the bar's start, and their back button lands where the bolt sits. Without quick edits for the
 * panel, only the actions show.
 */
export function PanelActionsWithQuickEdits({ panel, spacing = 'edit-actions', children }: Props) {
  const styles = useStyles2(getActionStyles);
  const swapStyles = useStyles2(getSwapStyles, spacing);
  const quickEdits = useQuickEdits(panel);
  const [showQuickEdits, setShowQuickEdits] = usePanelQuickEditsView(panel.state.key!);
  const { holdOpen, getReference } = useEditActionsPopover();
  const [bar, setBar] = useState<HTMLDivElement | null>(null);

  if (!quickEdits.edits.length) {
    return <>{children}</>;
  }

  const quickEditsLabel = t('dashboard-scene.panel-edit-actions.show-quick-edits', 'Quick edits');
  const backLabel = t('dashboard-scene.panel-edit-actions.show-panel-actions', 'Back to panel actions');

  const onShowQuickEdits = () => {
    setShowQuickEdits(true);
    DashboardInteractions.panelQuickEditsShown({
      panel_type: panel.state.pluginId,
      panel_id: getPanelIdForVizPanel(panel),
    });
  };

  return (
    <div className={swapStyles.stack}>
      <div className={swapStyles.layer} inert={showQuickEdits}>
        <IconButton
          name="bolt"
          variant="secondary"
          size="md"
          className={styles.action}
          aria-label={quickEditsLabel}
          tooltip={quickEditsLabel}
          tooltipPlacement="top"
          onClick={onShowQuickEdits}
        />
        {children}
      </div>
      <div className={cx(swapStyles.viewport, !showQuickEdits && swapStyles.viewportHidden)} inert={!showQuickEdits}>
        <div className={cx(swapStyles.layer, swapStyles.quick, showQuickEdits && swapStyles.quickShown)}>
          <div className={swapStyles.back}>
            <IconButton
              name="angle-left"
              variant="secondary"
              size="md"
              className={styles.action}
              aria-label={backLabel}
              tooltip={backLabel}
              tooltipPlacement="top"
              onClick={() => setShowQuickEdits(false)}
            />
          </div>
          <div className={swapStyles.inset} ref={setBar}>
            {/* Remounted on each swap, so a card left open closes as the quick edits slide away. */}
            <HeldQuickEditButtons
              key={String(showQuickEdits)}
              panel={panel}
              quickEdits={quickEdits}
              getPanelElement={getReference}
              bar={bar}
              holdOpen={holdOpen}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type HeldQuickEditButtonsProps = Omit<
  Parameters<typeof QuickEditButtons>[0],
  'onCardOpenChange' | 'buttonClassName'
> & {
  holdOpen: (hold: boolean) => void;
};

/** Holds the popover open while a card is, as the card is portaled outside it and hover would close it. */
function HeldQuickEditButtons({ holdOpen, ...props }: HeldQuickEditButtonsProps) {
  const holding = useRef(false);
  const onCardOpenChange = useCallback(
    (open: boolean) => {
      holding.current = open;
      holdOpen(open);
    },
    [holdOpen]
  );
  // A card closes with its buttons, e.g. when the popover swaps them out, and must not keep holding the popover.
  useEffect(
    () => () => {
      if (holding.current) {
        holdOpen(false);
      }
    },
    [holdOpen]
  );
  return <QuickEditButtons {...props} onCardOpenChange={onCardOpenChange} />;
}

const getSwapStyles = (theme: GrafanaTheme2, spacing: keyof typeof BAR_SPACING) => {
  const { paddingY, gap } = BAR_SPACING[spacing];
  return {
    // The negative margin undoes the popover's padding, so the quick edits cover the whole bar.
    stack: css({
      position: 'relative',
      margin: theme.spacing(-paddingY, -1),
    }),
    layer: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(gap),
      padding: theme.spacing(paddingY, 1),
    }),
    // The bar keeps the actions' width; the quick edits extend past its end when they need more room, so neither set
    // leaves empty space. It starts over the bar's border, so the back button lands where the bolt sits.
    viewport: css({
      position: 'absolute',
      top: -1,
      bottom: -1,
      left: -1,
      minWidth: 'calc(100% + 2px)',
      width: 'max-content',
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      // Above the actions' buttons, which are positioned and would otherwise paint through.
      zIndex: 1,
    }),
    // While empty it still spans past the bar, where it must not catch the pointer.
    viewportHidden: css({
      pointerEvents: 'none',
    }),
    quick: css({
      boxSizing: 'border-box',
      height: '100%',
      padding: 0,
      gap: 0,
      whiteSpace: 'nowrap',
      background: theme.components.dropdown.background,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      // In from the bar's start, so its leading edge sweeps over the actions and grows the menu as it goes.
      transform: 'translateX(-100%)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['transform'], {
          duration: theme.transitions.duration.shortest,
          easing: theme.transitions.easing.easeOut,
        }),
      },
    }),
    quickShown: css({
      transform: 'none',
    }),
    back: css({
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      padding: theme.spacing(paddingY, 1),
    }),
    inset: css({
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      flex: 1,
      gap: theme.spacing(gap),
      padding: theme.spacing(paddingY, 1),
      background: theme.colors.background.canvas,
      borderRadius: `${theme.shape.radius.default} 0 0 ${theme.shape.radius.default}`,
    }),
  };
};
