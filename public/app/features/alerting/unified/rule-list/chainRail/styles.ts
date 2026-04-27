import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

// Info-blue palette from v2-chain-rail-spec.md §6.
// TODO(design): promote to theme tokens once the pattern stabilises.
const CHAIN_BLUE = '#6E9FFF';
const CHAIN_TEXT = '#8AB8FF';
const CHAIN_BG_GROUP = 'rgba(110, 159, 255, 0.03)';
const CHAIN_BG_HEADER = 'rgba(110, 159, 255, 0.06)';
const CHAIN_ICON_BG = 'rgba(110, 159, 255, 0.12)';
const CHAIN_BORDER = 'rgba(110, 159, 255, 0.25)';
const CHAIN_ICON_BORDER = 'rgba(110, 159, 255, 0.45)';
const CHAIN_RAIL_COLOR = 'rgba(110, 159, 255, 0.6)';

export const getChainRailStyles = (theme: GrafanaTheme2) => ({
  chainGroup: css({
    position: 'relative',
    background: CHAIN_BG_GROUP,
    listStyle: 'none',
    padding: 0,
    margin: 0,

    '&::before': {
      content: '""',
      position: 'absolute',
      left: '18px',
      top: '28px',
      bottom: '12px',
      width: '2px',
      background: CHAIN_RAIL_COLOR,
      pointerEvents: 'none',
    },
  }),
  // `&&&` triples class specificity so we beat ListSection's
  // `.groupItemsWrapper li[role=treeitem]::before` (specificity 0,2,2) which
  // would otherwise override our dot's height / borderLeft and render a
  // vertical pill instead of a circle.
  chainRule: css({
    '&&&': {
      position: 'relative',
      paddingLeft: theme.spacing(4),
    },
    '&&&::before': {
      content: '""',
      position: 'absolute',
      boxSizing: 'border-box',
      left: '13px',
      // Align the dot's centre with the status icon's centre.
      // Derived from ListItem.tsx:
      //   <li> padding-top theme.spacing(1) = 8px
      // + .statusIcon marginTop theme.spacing(0.5) = 4px
      // + half of the 16x16 status icon = 8px      → icon centre at 20px
      // - half of the 12x12 dot = 6px              → dot top at 14px
      // If ListItem's padding or .statusIcon's margin changes, update here.
      top: '14px',
      marginTop: 0,
      marginLeft: 0,
      width: '12px',
      height: '12px',
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.background.canvas,
      border: `2px solid ${CHAIN_BLUE}`,
      zIndex: 1,
      pointerEvents: 'none',
    },
  }),
  chainHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 1.5),
    fontSize: theme.typography.size.sm,
    color: CHAIN_TEXT,
    background: CHAIN_BG_HEADER,
    borderTop: `1px dashed ${CHAIN_BORDER}`,
    borderBottom: `1px dashed ${CHAIN_BORDER}`,
  }),
  chainHeaderIcon: css({
    width: '20px',
    height: '20px',
    borderRadius: theme.shape.radius.circle,
    background: CHAIN_ICON_BG,
    border: `1px solid ${CHAIN_ICON_BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: CHAIN_TEXT,
    flex: '0 0 auto',
  }),
  chainHeaderName: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: CHAIN_TEXT,
  }),
  chainHeaderCount: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    color: theme.colors.text.secondary,
    fontSize: '11px',
  }),
  chainHeaderSpacer: css({
    flex: 1,
  }),
  chainHeaderMeta: css({
    fontSize: '11px',
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    display: 'flex',
    gap: theme.spacing(1.5),
    alignItems: 'center',
  }),
  chainHeaderActions: css({
    display: 'flex',
    gap: theme.spacing(0.25),
  }),
});
