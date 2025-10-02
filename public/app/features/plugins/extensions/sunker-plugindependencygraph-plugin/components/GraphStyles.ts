/**
 * Graph Styles
 *
 * Centralized styling for the dependency graph components.
 */

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { INTERACTION_CONSTANTS, TYPOGRAPHY_CONSTANTS, VISUAL_CONSTANTS } from '../constants';


export const getGraphStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      width: 100%;
      height: 100%;
      background: ${theme.colors.background.primary};
      border-radius: ${theme.shape.radius.default};
      overflow: auto;
    `,

    svg: css`
      width: 100%;
      min-height: 100%;
    `,

    // Node styles
    node: css`
      transition: filter ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};

      &:hover {
        filter: brightness(${INTERACTION_CONSTANTS.HOVER_BRIGHTNESS});
      }
    `,

    nodeBox: css`
      filter: drop-shadow(
        ${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px ${VISUAL_CONSTANTS.SHADOW_BLUR}px
          rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY})
      );
      transition: all ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};
    `,

    nodeLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.PLUGIN_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    nodeTypeBadge: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    nodeRole: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    // Content indicator styles
    contentIndicator: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    // API label styles
    apiLabel: css`
      transition: all ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};
      filter: drop-shadow(
        ${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y / 2}px
          ${VISUAL_CONSTANTS.SHADOW_BLUR / 2}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY / 1.5})
      );
    `,

    apiLabelText: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.API_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT};
      font-family: ${TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY};
      pointer-events: none;
      user-select: none;
    `,

    // Link styles
    link: css`
      transition: all ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};

      &:hover {
        stroke-width: ${VISUAL_CONSTANTS.THICK_STROKE_WIDTH};
        filter: brightness(${INTERACTION_CONSTANTS.LINK_HOVER_BRIGHTNESS});
      }
    `,

    linkHighlighted: css`
      transition: all ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};

      &:hover {
        stroke-width: ${VISUAL_CONSTANTS.VERY_THICK_STROKE_WIDTH};
        filter: brightness(${INTERACTION_CONSTANTS.HIGHLIGHTED_LINK_BRIGHTNESS});
      }
    `,

    linkLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
      background: ${theme.colors.background.primary};
    `,

    // App ID label
    appIdLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT};
      font-family: ${TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY};
      pointer-events: none;
      user-select: none;
    `,

    roleLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    // Extension group styles
    extensionGroupBox: css`
      filter: drop-shadow(
        ${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px ${VISUAL_CONSTANTS.SHADOW_BLUR}px
          rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY})
      );
      transition: all ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};

      &:hover {
        filter: drop-shadow(
          ${VISUAL_CONSTANTS.SHADOW_OFFSET_X}px ${VISUAL_CONSTANTS.SHADOW_OFFSET_Y}px
            ${VISUAL_CONSTANTS.ENHANCED_SHADOW_BLUR}px rgba(0, 0, 0, ${VISUAL_CONSTANTS.SHADOW_OPACITY + 0.05})
        );
      }
    `,

    extensionPointBox: css`
      transition: filter ${INTERACTION_CONSTANTS.DEFAULT_TRANSITION};

      &:hover {
        filter: brightness(${INTERACTION_CONSTANTS.HOVER_BRIGHTNESS});
      }
    `,

    definingPluginLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.PLUGIN_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    extensionPointLabel: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.SEMI_BOLD_WEIGHT};
      font-family: ${TYPOGRAPHY_CONSTANTS.MONOSPACE_FAMILY};
      pointer-events: none;
      user-select: none;
    `,

    extensionTypeBadge: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT};
      pointer-events: none;
      user-select: none;
    `,

    // Section header styles
    sectionHeader: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE};
      font-weight: ${TYPOGRAPHY_CONSTANTS.BOLD_WEIGHT};
      letter-spacing: 1px;
      pointer-events: none;
      user-select: none;
      fill: ${theme.colors.text.primary};
    `,

    // Empty state styles
    emptyState: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${theme.colors.text.secondary};
      text-align: center;

      p {
        margin: 0.5rem 0;
      }
    `,

    // Description text styles
    descriptionInlineText: css`
      font-size: ${TYPOGRAPHY_CONSTANTS.DESCRIPTION_SIZE}px;
      font-weight: ${TYPOGRAPHY_CONSTANTS.MEDIUM_WEIGHT};
      font-style: italic;
      pointer-events: none;
      user-select: none;
      opacity: 0.9;
      font-family: ${theme.typography.fontFamily};
    `,
  };
};
