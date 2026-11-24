import { type GrafanaTheme2 } from '@grafana/data';
import { dashVar } from 'app/core/dashboardStyle/cssVars';

/**
 * Locally installed book faces only; nothing is downloaded. Ends in the generic
 * serif so every platform gets a readable fallback.
 */
export const REPORT_SERIF_STACK =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Charter, 'Bitstream Charter', 'Source Serif 4', 'Source Serif Pro', 'Noto Serif', Georgia, Cambria, 'Times New Roman', serif";

/** Bounded measure keeps long-form lines readable on wide dashboards. */
export const REPORT_PROSE_MEASURE = '68ch';

/**
 * Editorial prose shared by report section summaries and the editorial Text style.
 * Typography only: no layout, so the caller decides where the block sits.
 */
export function getReportProseStyles(theme: GrafanaTheme2) {
  return {
    // A dashboard style supplies its body face and ink; without one, prose stays in the serif stack.
    fontFamily: dashVar('fontBody', REPORT_SERIF_STACK),
    fontSize: '1.0625rem',
    lineHeight: 1.6,
    fontWeight: theme.typography.fontWeightRegular,
    color: dashVar('ink', theme.colors.text.primary),
    maxWidth: REPORT_PROSE_MEASURE,
    // Lining figures keep numbers in prose consistent with the stat values beside them.
    fontVariantNumeric: 'lining-nums proportional-nums',
    textWrap: 'pretty',
    overflowWrap: 'break-word',

    '& p, & ul, & ol, & blockquote, & pre': {
      margin: `0 0 ${theme.spacing(1.5)}`,
    },
    '& > :last-child': {
      marginBottom: 0,
    },
    '& ul, & ol': {
      paddingLeft: theme.spacing(3),
    },
    '& li + li': {
      marginTop: theme.spacing(0.5),
    },
    '& li::marker': {
      color: theme.colors.text.secondary,
    },
    '& strong': {
      // The UI bold (500) is too light to read as emphasis in a book face.
      fontWeight: 600,
    },
    '& a': {
      color: theme.colors.text.link,
      textDecoration: 'underline',
      textDecorationThickness: '1px',
      textUnderlineOffset: '0.2em',
      '&:hover': {
        textDecorationThickness: '2px',
      },
    },
    '& code': {
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: '0.85em',
      fontVariantNumeric: 'normal',
      padding: '0.1em 0.35em',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
    },
    '& pre': {
      padding: theme.spacing(1, 1.5),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      overflowX: 'auto',
      '& code': {
        padding: 0,
        border: 'none',
        background: 'transparent',
      },
    },
    '& blockquote': {
      paddingLeft: theme.spacing(2),
      borderLeft: `2px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    },
    '& hr': {
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(2, 0),
    },
  } as const;
}

/**
 * The editorial Text style: report prose applied over the Text panel's own markdown output.
 * Scoped to `.markdown-html` so it outranks the global markdown rules on the same element.
 */
export function getEditorialMarkdownStyles(theme: GrafanaTheme2) {
  return {
    '&.markdown-html': {
      ...getReportProseStyles(theme),
      '& h1, & h2, & h3, & h4, & h5, & h6': {
        fontFamily: dashVar('fontDisplay', REPORT_SERIF_STACK),
        fontWeight: theme.typography.fontWeightMedium,
        letterSpacing: '-0.01em',
        lineHeight: 1.25,
        margin: theme.spacing(0, 0, 1),
      },
    },
  } as const;
}
