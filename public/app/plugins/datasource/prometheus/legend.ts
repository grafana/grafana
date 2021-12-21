import { Labels } from '@grafana/data';

/** replace labels in a string.  Used for loki+prometheus legend formats */
export function renderLegendFormat(aliasPattern: string, aliasData: Labels): string {
  // \{\{ Escaped "{{" characters (char code 123).
  //
  // \s*  Matches any whitespace character (spaces, tabs, line breaks) 0 or more times.
  //
  // (?!  Negative lookahead. Specifies a group that can not match after the main
  //      expression (if it matches, the result is discarded).
  //
  //        [ Character set. Match any character in the set below.
  //          \s Whitespace. Matches any whitespace character (spaces, tabs, line breaks).
  //          \{ Escaped character. Matches a "{" character (char code 123).
  //          \} Escaped character. Matches a "}" character (char code 125).
  //        ]
  //
  // )
  //
  // (    Capturing group #1. Groups multiple tokens together and creates a capture group for extracting a
  //      substring or using a backreference.
  //
  //        . Dot. Matches any character except line breaks.
  //        + Quantifier. Match 1 or more of the preceding token.
  //        ? Lazy. Makes the preceding quantifier lazy, causing it to match as few characters as possible.
  //
  // )
  //
  // (?<! Negative lookbehind. Specifies a group that can not match before the main
  //      expression (if it matches, the result is discarded).
  //
  //            [ Character set. Match any character in the set below.
  //              \s Whitespace. Matches any whitespace character (spaces, tabs, line breaks).
  //              \{ Escaped character. Matches a "{" character (char code 123).
  //              \} Escaped character. Matches a "}" character (char code 125).
  //            ]
  //
  // )
  //
  // \s*  Matches any whitespace character (spaces, tabs, line breaks) 0 or more times.
  //
  // \}\} Escaped "}}" characters (char code 125).
  const aliasRegex = /\{\{\s*(?![\s\{\}])(.+?)(?<![s\{\}])\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, (_, g1) => (aliasData[g1] ? aliasData[g1] : g1));
}
