import { injectGlobal } from '@emotion/css';

interface FontFile {
  family: string;
  file: string;
  style: 'normal' | 'italic';
  /** A single weight or a variable range. */
  weight: string;
}

const FONTS: FontFile[] = [
  { family: 'Newsreader', file: 'newsreader-latin-opsz-normal.woff2', style: 'normal', weight: '200 800' },
  { family: 'Newsreader', file: 'newsreader-latin-opsz-italic.woff2', style: 'italic', weight: '200 800' },
  { family: 'Source Serif 4', file: 'source-serif-4-latin-opsz-normal.woff2', style: 'normal', weight: '200 900' },
  { family: 'Source Serif 4', file: 'source-serif-4-latin-opsz-italic.woff2', style: 'italic', weight: '200 900' },
  { family: 'Fraunces', file: 'fraunces-latin-opsz-normal.woff2', style: 'normal', weight: '100 900' },
  { family: 'Fraunces', file: 'fraunces-latin-opsz-italic.woff2', style: 'italic', weight: '100 900' },
  { family: 'Libre Franklin', file: 'libre-franklin-latin-wght-normal.woff2', style: 'normal', weight: '100 900' },
  { family: 'Libre Franklin', file: 'libre-franklin-latin-wght-italic.woff2', style: 'italic', weight: '100 900' },
  { family: 'Inter Tight', file: 'inter-tight-latin-wght-normal.woff2', style: 'normal', weight: '100 900' },
  { family: 'IBM Plex Mono', file: 'ibm-plex-mono-latin-400-normal.woff2', style: 'normal', weight: '400' },
  { family: 'IBM Plex Mono', file: 'ibm-plex-mono-latin-500-normal.woff2', style: 'normal', weight: '500' },
];

let registered = false;

/**
 * Declares the bundled style faces once. Declaring a face downloads nothing; the browser fetches a
 * file only when a styled dashboard renders text in that family.
 */
export function registerStyleFonts() {
  if (registered) {
    return;
  }
  registered = true;

  const publicPath = typeof window !== 'undefined' && window.__grafana_public_path__;
  const root = `${publicPath || 'public/'}fonts/report/`;

  injectGlobal(
    FONTS.map((font) => ({
      '@font-face': {
        // Quoted: an unquoted family with a number in it (Source Serif 4) is invalid CSS.
        fontFamily: `'${font.family}'`,
        fontStyle: font.style,
        fontWeight: font.weight,
        fontDisplay: 'swap',
        src: `url('${root}${font.file}') format('woff2')`,
      },
    }))
  );
}
