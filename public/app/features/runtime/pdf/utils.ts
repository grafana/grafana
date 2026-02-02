import { parse } from 'csv-parse/sync';
import jsPDF from 'jspdf';

/**
 * Parse CSV content string into an object with header and body
 * @param csvContent The CSV content as a string
 * @returns Promise resolving to an object with header array and body array
 */
export const parseCSV = async (
  csvContent: string
): Promise<{
  header: string[];
  body: string[][];
}> => {
  // Ensure csvContent is a string
  if (typeof csvContent !== 'string') {
    throw new Error('CSV content must be a string');
  }
  const rows = await parse(csvContent, {
    trim: true,
    skip_empty_lines: true,
    bom: true,
    autoParse: true,
  });
  return {
    header: rows.length > 0 ? rows[0] : [],
    body: rows.length > 1 ? rows.slice(1) : [],
  };
};

/**
 * Process meta tags of headers and return array of meta objects.
 *
 * @param headers - The headers object.
 * @param csvMetaTag - The delimiter used for splitting the column value and metadata.
 * @returns array - Returns meta tag objects which contains config details for each header.
 */
export const parseCsvMeta = (records: string[], tag: string): any[] => {
  return records.map((header) => {
    const [headerName, meta] = header.split(tag);

    const metaData: any = { name: headerName };
    const metaItems = meta ? meta.trim().split(/\s+/) : [];

    metaItems.forEach((item) => {
      const [key, value] = item.split('=');

      switch (key) {
        case 't':
          metaData.type = value;
          break;
        case 'al':
          metaData.alignment = value;
          break;
        case 'ct':
          metaData.colorType = value;
          break;
        case 'w':
          metaData.width = parseInt(value, 10);
          break;
        case 'lang':
          metaData.lang = value;
          break;
        case 'htc':
          metaData.headerColor = value;
          break;
        case 'hbg':
          metaData.headerBgColor = value;
          break;
        default:
          break;
      }
    });

    return metaData;
  });
};

export const rowsLimitNote = (rowsLimit = 5000) => {
  return `* Note: The PDF displays only the first ${rowsLimit} records per each tabular panel.`;
};

/**
 * Blends a given hex color with a specified theme background (light or dark).
 * This is using the Alpha Blending Formula algorithm.
 *
 * @param hex8 - The 8-character hex color string (including alpha channel) to blend, e.g., "#RRGGBBAA".
 * @param theme - The theme background to blend with, either 'light' or 'dark'.
 * @returns An object containing the blended RGB values.
 */
export const blendWithTheme = (hex8: string, theme: 'light' | 'dark') => {
  hex8 = hex8.replace('#', ''); // Remove #

  let r = parseInt(hex8.substring(0, 2), 16);
  let g = parseInt(hex8.substring(2, 4), 16);
  let b = parseInt(hex8.substring(4, 6), 16);
  let alpha = parseInt(hex8.substring(6, 8), 16) / 255; // Convert AA to 0-1 range

  let bg = theme === 'dark' ? 0 : 255; // Black for dark, White for light

  // Blend with theme background
  let rBlended = Math.round(r * alpha + bg * (1 - alpha));
  let gBlended = Math.round(g * alpha + bg * (1 - alpha));
  let bBlended = Math.round(b * alpha + bg * (1 - alpha));

  return { r: rBlended, g: gBlended, b: bBlended };
};
/*
Truncate the dashboard path when it exceeds the 70% of Pagewidth
 */
export const truncateText = (doc: jsPDF, text: any, maxWidth: number) => {
  if (maxWidth <= 0) {
    // if in case maxwidth is 0 then breaking the loop.
    return '';
  }
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  while (doc.getTextWidth(text) > maxWidth) {
    text = text.slice(0, -1); // Remove last character
  }
  return text + '...'; // Append ellipsis
};
