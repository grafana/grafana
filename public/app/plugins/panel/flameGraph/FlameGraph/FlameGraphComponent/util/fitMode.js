// Even though there are only 2 values
// Which could be represented in a boolean fashion
// Let's use an Enum in case we want to use new modes,
// for example a new heuristic based on the language
export const FitModes = {
  TAIL: 'TAIL',
  HEAD: 'HEAD',
};

const margin = 3;

/**
 * Returns a text and margin left used to write text into a canvas rectangle
 *
 * @param {FitModes} mode -
 * @param {number} charSize - Size in pixels of an individual character. Assumes it's a monospace font.
 * @param {number} rectWidth - Width in pixels of the rectangle
 * @param {string} fullText - The text that will be first tried.
 * @param {string} shortText - The text that willbe used when fullText can't fit. It's normally a substring of the original text.
 */
export function fitToCanvasRect({ mode, charSize, rectWidth, fullText, shortText }) {
  switch (mode) {
    case FitModes.TAIL:
      // Case 1:
      // content fits rectangle width
      // | rectangle |
      // | text |
      if (charSize * fullText.length <= rectWidth) {
        // assume it's a monospaced font
        return {
          mode,
          text: fullText,
          marginLeft: margin,
        };
      }

      // assume it's a monospaced font
      // if not the case, use
      // ctx.measureText(shortName).width
      const shortTextWidth = charSize * shortText.length;

      // Case 2:
      // short text fits rectangle width
      // | rectangle |
      // | long_text_text |
      // | shorttext |
      if (shortTextWidth <= rectWidth) {
        // assume it's a monospaced font
        return {
          mode,
          text: shortText,
          marginLeft: margin,
        };
      }

      // Case 3:
      // short text is bigger than rectangle width
      // add a negative margin left
      // so that the 'tail' of the string is visible
      //     | rectangle |
      // | my_short_text |
      return {
        mode,
        text: shortText,
        marginLeft: -(shortTextWidth - rectWidth + margin),
      };

    // Case 3:
    // Normal
    case FitModes.HEAD:
    default:
      return {
        mode,
        text: fullText,
        marginLeft: margin,
      };
  }
}

/**
 * Returns an inline style in React format
 * used to fit the content into a table cell
 * or an empty object if not applicable.
 * @param {FitModes} mode - The mode
 */
export function fitIntoTableCell(mode) {
  switch (mode) {
    case FitModes.TAIL:
      return {
        // prints from right to left
        direction: 'rtl',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      };

    case FitModes.HEAD:
    default:
      return {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      };
  }
}
