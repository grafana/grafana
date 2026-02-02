// BMC file
// Author - mahmedi

export type Script =
  | 'latin'
  | 'latinEx'
  | 'latinExtA'
  | 'thai'
  | 'arabic'
  | 'hebrew'
  | 'greek'
  | 'cyrillic'
  | 'chinese'
  | 'japanese'
  | 'korean';

const SCRIPT_RANGES: Array<{ script: Script; start: number; end: number }> = [
  { script: 'latin', start: 0x0000, end: 0x007f },
  { script: 'latinEx', start: 0x0080, end: 0x00ff }, // Latin-1 Supplement
  { script: 'latinExtA', start: 0x0100, end: 0x017f }, // Latin Extended-A (needed for Turkish)
  { script: 'greek', start: 0x0370, end: 0x03ff },
  { script: 'cyrillic', start: 0x0400, end: 0x04ff },
  { script: 'hebrew', start: 0x0590, end: 0x05ff },
  { script: 'arabic', start: 0x0600, end: 0x06ff },
  { script: 'thai', start: 0x0e00, end: 0x0e7f },
  { script: 'japanese', start: 0x3040, end: 0x30ff }, // Hiragana/Katakana
  { script: 'chinese', start: 0x4e00, end: 0x9fff }, // CJK Unified Ideographs (Chinese)
  { script: 'korean', start: 0xac00, end: 0xd7af }, // Hangul (Korean)
];

const binarySearchScript = (code: number): Script | null => {
  let low = 0;
  let high = SCRIPT_RANGES.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const range = SCRIPT_RANGES[mid];

    if (code >= range.start && code <= range.end) {
      // Return null for latin and latinEx so that it checks for next word.
      if (range.script === 'latin' || range.script === 'latinEx') {
        return null;
      }
      return range.script;
    } else if (code < range.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return null;
};

export const detectScript = (text: string): Script | null => {
  if (text === '') {
    return null;
  }
  const textArr = text.trim().split(/[\s\n\t]+/);
  for (const word of textArr) {
    if (word !== '') {
      const code = word.charCodeAt(0); // Check the first character of each word
      const detectedScript = binarySearchScript(code);

      if (detectedScript) {
        return detectedScript; // Set for non-Latin scripts
      }
    }
  }
  return null;
};

// Function to check if multilingual PDF is enabled
export const isMultilingualPdfEnabled = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const isMultilingualEnabled = urlParams.get('multilingualPdf');
  return isMultilingualEnabled === 'true';
};

export const isExportFooterEnabled = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const isExportFooterEnabled = urlParams.get('tableFooterExport');
  return isExportFooterEnabled === 'true';
};
