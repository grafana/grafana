import _ from 'lodash';
import twemoji from 'twemoji';
import emojiDef from './emoji_def';

const DEFAULT_ICON = '1f494'; // Broken heart
const TWEMOJI_BASE = '/public/vendor/npm/twemoji/2/';
const CP_SEPARATOR = emojiDef.CP_SEPARATOR; // Separator for double-sized codepoints like 1f1f7-1f1fa
const DEFAULT_EMOJI_CLASS = 'emoji gf-event-icon';

/**
 * Convert code point into HTML element.
 * 1f1f7 => <img src=".../1f1f7.svg" ...>
 *
 * @param codepoint HEX code point, for example 1f1f7, 1f1f7-1f1fa
 * @param className class (or classes) attribute for each generated image.
 */
export function buildEmojiElem(codepoint, className = DEFAULT_EMOJI_CLASS) {
  let utfCode;

  // handle double-sized codepoints like 1f1f7-1f1fa
  if (codepoint.indexOf(CP_SEPARATOR) !== -1) {
    let codepoints = codepoint.split(CP_SEPARATOR);
    utfCode = _.map(codepoints, twemoji.convert.fromCodePoint).join('');
  } else {
    utfCode = twemoji.convert.fromCodePoint(codepoint);
  }

  let emoji = twemoji.parse(utfCode, {
    base: TWEMOJI_BASE,
    folder: 'svg',
    ext: '.svg',
    attributes: attributesCallback,
    className: className
  });

  return emoji;
}

// Build attrs for emoji HTML element
function attributesCallback(rawText, iconId) {
  return {
    title: emojiDef.emojiMap[iconId],
    codepoint: iconId
  };
}

export default {
  buildEmojiElem
};
