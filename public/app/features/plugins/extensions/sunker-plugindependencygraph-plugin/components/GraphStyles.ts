/**
 * Graph Styles
 *
 * Centralized styling for the dependency graph components.
 */

import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

import { INTERACTION_CONSTANTS, TYPOGRAPHY_CONSTANTS, VISUAL_CONSTANTS } from '../constants';

export const getGraphStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      minHeight: '100%',
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),

    svg: css({
      width: '100%',
      minHeight: '100%',
    }),

    // Node styles
    node: css({
      ...theme.transitions.create(['filter']),
      '&:hover': {
        filter: `brightness(${INTERACTION_CONSTANTS.HOVER_BRIGHTNESS})`,
      },
    }),

    nodeBox: css({
      filter: `drop-shadow(${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px ${VISUAL_CONSTANTS.SHADOW_BLUR}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY}))`,
      ...theme.transitions.create(),
    }),

    nodeLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.PLUGIN_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    nodeTypeBadge: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    nodeRole: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    // Content indicator styles
    contentIndicator: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    // API label styles
    apiLabel: css({
      ...theme.transitions.create(),
      filter: `drop-shadow(${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y / 2}px ${VISUAL_CONSTANTS.SHADOW_BLUR / 2}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY / 1.5}))`,
    }),

    apiLabelText: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.API_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT,
      fontFamily: TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    // Link styles
    link: css({
      ...theme.transitions.create(),
      '&:hover': {
        strokeWidth: VISUAL_CONSTANTS.THICK_STROKE_WIDTH,
        filter: `brightness(${INTERACTION_CONSTANTS.LINK_HOVER_BRIGHTNESS})`,
      },
    }),

    linkHighlighted: css({
      ...theme.transitions.create(),
      '&:hover': {
        strokeWidth: VISUAL_CONSTANTS.VERY_THICK_STROKE_WIDTH,
        filter: `brightness(${INTERACTION_CONSTANTS.HIGHLIGHTED_LINK_BRIGHTNESS})`,
      },
    }),

    linkLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
      background: theme.colors.background.primary,
    }),

    // App ID label
    appIdLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT,
      fontFamily: TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    roleLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    // Extension group styles
    extensionGroupBox: css({
      filter: `drop-shadow(${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px ${VISUAL_CONSTANTS.SHADOW_BLUR}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY}))`,
      ...theme.transitions.create(),
      '&:hover': {
        filter: `drop-shadow(${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px ${VISUAL_CONSTANTS.ENHANCED_SHADOW_BLUR}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY + 0.05}))`,
      },
    }),

    extensionPointBox: css({
      ...theme.transitions.create(['filter']),
      '&:hover': {
        filter: `brightness(${INTERACTION_CONSTANTS.HOVER_BRIGHTNESS})`,
      },
    }),

    definingPluginLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.PLUGIN_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    extensionPointLabel: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT,
      fontFamily: TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    extensionTypeBadge: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT,
      pointerEvents: 'none',
      userSelect: 'none',
    }),

    // Section header styles
    sectionHeader: css({
      fontSize: TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE,
      fontWeight: TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT,
      letterSpacing: '1px',
      pointerEvents: 'none',
      userSelect: 'none',
      fill: theme.colors.text.primary,
    }),

    // Empty state styles
    emptyState: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: theme.colors.text.secondary,
      textAlign: 'center',
      '& p': {
        margin: '0.5rem 0',
      },
    }),

    // Description text styles
    descriptionInlineText: css({
      fontSize: `${TYPOGRAPHY_CONSTANTS.DESCRIPTION_SIZE}px`,
      fontWeight: TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT,
      fontStyle: 'italic',
      pointerEvents: 'none',
      userSelect: 'none',
      opacity: 0.9,
      fontFamily: theme.typography.fontFamily,
    }),
  };
};
