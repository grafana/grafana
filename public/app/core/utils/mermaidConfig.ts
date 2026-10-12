import type { MermaidConfig } from 'mermaid';

import type { GrafanaTheme2 } from '@grafana/data';

export function getMermaidConfig(theme: GrafanaTheme2): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    // sanitizeSVGContent drops <foreignObject>, where mermaid puts HTML labels,
    // so the shapes would survive with no text in them.
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true },
    // We report failures ourselves; never let mermaid inject its own error graphic.
    suppressErrorRendering: true,
    theme: 'base',
    fontFamily: theme.typography.fontFamily,
    themeVariables: {
      darkMode: theme.isDark,
      background: theme.colors.background.primary,
      mainBkg: theme.colors.background.secondary,
      primaryColor: theme.colors.background.secondary,
      primaryTextColor: theme.colors.text.primary,
      primaryBorderColor: theme.colors.border.medium,
      secondaryColor: theme.colors.background.canvas,
      tertiaryColor: theme.colors.background.elevated,
      lineColor: theme.colors.border.strong,
      textColor: theme.colors.text.primary,
      titleColor: theme.colors.text.maxContrast,
      nodeBorder: theme.colors.border.medium,
      clusterBkg: theme.colors.background.canvas,
      clusterBorder: theme.colors.border.weak,
      edgeLabelBackground: theme.colors.background.primary,
      fontSize: `${theme.typography.fontSize}px`,
    },
  };
}
