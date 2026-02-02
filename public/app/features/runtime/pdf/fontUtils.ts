import jsPDF from 'jspdf';

import { detectScript, isMultilingualPdfEnabled } from '@grafana/data/src/utils/scriptUtils';

import { FontOptions, Script } from './types';

// Font-specific methods for lazy loading
const fontLoaders = {
  loadFont: (fontPath: string) =>
    import(/* webpackChunkName: "fonts/[request]" */ `./fontsBase64/${fontPath}`).then((module) => module.default),
};

// Helper function to create font entries with lazy loading
const createFontEntry = (
  fontName: string,
  fileName: string,
  fontPath: string,
  fontStyle: 'normal' | 'bold' | 'italic'
): FontOptions => ({
  fontName,
  fileName,
  getFileContent: () => fontLoaders.loadFont(fontPath),
  fontStyle,
});

// shared NotoSans fonts
const notoSansRegular = createFontEntry('NotoSans', 'NotoSans-Regular.ttf', 'NotoSans-Regular', 'normal');
const notoSansBold = createFontEntry('NotoSans', 'NotoSans-Bold.ttf', 'NotoSans-Bold', 'bold');

// Fonts map with font entries
export const fontsMap: Record<string, FontOptions | undefined> = {
  latin: undefined, // fallback to helvetica
  latinEx: undefined, // fallback to helvetica
  latinExtA: notoSansRegular,
  latinExtABold: notoSansBold,

  barcode: createFontEntry('c39hrp24dhtt', 'c39hrp24dhtt.ttf', 'c39hrp24dhtt', 'normal'),

  greek: notoSansRegular,
  greekBold: notoSansBold,

  cyrillic: notoSansRegular,
  cyrillicBold: notoSansBold,

  thai: createFontEntry('NotoSansThai', 'NotoSansThai-Regular.ttf', 'NotoSansThai-Regular', 'normal'),
  thaiBold: createFontEntry('NotoSansThai', 'NotoSansThai-Bold.ttf', 'NotoSansThai-Bold', 'bold'),

  arabic: createFontEntry('NotoSansArabic', 'NotoSansArabic-Regular.ttf', 'NotoSansArabic-Regular', 'normal'),
  arabicBold: createFontEntry('NotoSansArabic', 'NotoSansArabic-Bold.ttf', 'NotoSansArabic-Bold', 'bold'),

  hebrew: createFontEntry('NotoSansHebrew', 'NotoSansHebrew-Regular.ttf', 'NotoSansHebrew-Regular', 'normal'),
  hebrewBold: createFontEntry('NotoSansHebrew', 'NotoSansHebrew-Bold.ttf', 'NotoSansHebrew-Bold', 'bold'),

  chinese: createFontEntry('NotoSansSC', 'NotoSansSC-Regular.ttf', 'NotoSansSC-Regular', 'normal'),
  chineseBold: createFontEntry('NotoSansSC', 'NotoSansSC-Bold.ttf', 'NotoSansSC-Bold', 'bold'),

  japanese: createFontEntry('NotoSansJP', 'NotoSansJP-Regular.ttf', 'NotoSansJP-Regular', 'normal'),
  japaneseBold: createFontEntry('NotoSansJP', 'NotoSansJP-Bold.ttf', 'NotoSansJP-Bold', 'bold'),

  korean: createFontEntry('NotoSansKR', 'NotoSansKR-Regular.ttf', 'NotoSansKR-Regular', 'normal'),
  koreanBold: createFontEntry('NotoSansKR', 'NotoSansKR-Bold.ttf', 'NotoSansKR-Bold', 'bold'),
};

// Detect script for items
export const detectScriptForItems = (items: string[]): Script | null => {
  for (const item of items) {
    if (item) {
      const detectedScript = detectScript(item); // Use shared utility
      if (detectedScript) {
        return detectedScript; // Return the first detected non-Latin script
      }
    }
  }
  return null;
};

// Get font for a detected script
export const getFontForScript = (detectedScript: Script): FontOptions | null => {
  return fontsMap[detectedScript] || null;
};

export const registerFont = (font: FontOptions, doc: jsPDF) => {
  doc.addFileToVFS(font.fileName, font.fileContent!);
  doc.addFont(font.fileName, font.fontName, font.fontStyle);
};

export const loadAndRegisterFont = async (doc: jsPDF, detectedScript: Script): Promise<string | null> => {
  const font = getFontForScript(detectedScript);
  if (font) {
    const fileContent = await font.getFileContent();
    registerFont({ ...font, fileContent }, doc);
    const boldFont = getFontForScript(`${detectedScript}Bold` as Script);
    if (boldFont) {
      const fileContent = await boldFont.getFileContent();
      registerFont({ ...boldFont, fileContent }, doc);
    }
    
    // Apply Hebrew text rendering patch after Hebrew font is loaded
    if (detectedScript === 'hebrew') {
      patchHebrewTextOptions(doc);
    }
    
    return font.fontName;
  }
  return null;
};

export const getMultilingualFont = async (
  doc: jsPDF,
  contentItems: string[],
  scriptFromCSV: Script | null = null
): Promise<string | null> => {
  if (!isMultilingualPdfEnabled()) {
    return null;
  }

  let detectedScript = scriptFromCSV;
  if (!detectedScript || detectedScript === 'latin') {
    detectedScript = detectScriptForItems(contentItems);
  }

  if (detectedScript && detectedScript !== 'latin') {
    const fontName = await loadAndRegisterFont(doc, detectedScript);
    
    // Additional safety check: Apply Hebrew text rendering patch if Hebrew script is detected
    if (detectedScript === 'hebrew' && fontName) {
      patchHebrewTextOptions(doc);
    }
    
    return fontName;
  }

  return null;
};

/**
 * Monkey-patches the jsPDF.text method to fix Hebrew text rendering.
 *
 * This utility wraps the original doc.text method to automatically merge Hebrew text rendering
 * options. It preserves all original method behavior including method chaining and supports
 * both string and string[] inputs. Caller options override Hebrew defaults.
 *
 * The patch is idempotent - calling this function multiple times on the same jsPDF instance
 * will not apply the patch more than once.
 *
 * @param doc - The jsPDF instance to patch
 */
export const patchHebrewTextOptions = (doc: jsPDF) => {
  if ((doc.text as any).__patchedHebrew) {
    return;
  }
  (doc.text as any).__patchedHebrew = true;
  const originalText = doc.text.bind(doc);
  doc.text = (text: string | string[], x: number, y: number, options?: any, transform?: any): jsPDF => {
    const hebrewOptions = {
      isInputVisual: false,
      isOutputVisual: true,
      isInputRtl: false,
      isOutputRtl: false,
      isSymmetricSwapping: true,
      ...options, // allow caller overrides
    };

    return originalText(text, x, y, hebrewOptions, transform);
  };
};
