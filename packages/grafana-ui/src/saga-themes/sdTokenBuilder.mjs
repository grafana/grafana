import { registerTransforms } from '@tokens-studio/sd-transforms';
import JsonToTs from 'json-to-ts';
import StyleDictionary from 'style-dictionary';

registerTransforms(StyleDictionary);

const { minifyDictionary } = StyleDictionary.formatHelpers;
StyleDictionary.registerFormat({
  name: 'javascript/nested',
  formatter: function (dictionary) {
    return `export default ${JSON.stringify(minifyDictionary(dictionary.tokens), null, 2)};\n`;
  },
});

StyleDictionary.registerFormat({
  name: 'typescript/nested',
  formatter: function (dictionary) {
    console.info(JsonToTs(minifyDictionary(dictionary.tokens)).join('\n'));
    return `export default ${JsonToTs(minifyDictionary(dictionary.tokens)).join('\n')}\n`;
  },
});

const coreTokens = [
  {
    destination: 'code/core/color.ts',
    tokens: ['color'],
  },
  {
    destination: 'code/core/border.ts',
    tokens: ['borderWidth', 'borderRadius'],
  },
  {
    destination: 'code/core/opacity.ts',
    tokens: ['opacity'],
  },
  {
    destination: 'code/core/zIndex.ts',
    tokens: ['other'],
  },
  {
    destination: 'code/core/typography.ts',
    tokens: [
      'paragraphSpacing',
      'textCase',
      'textDecoration',
      'letterSpacing',
      'lineHeights',
      'fontSizes',
      'fontWeights',
      'fontFamilies',
    ],
  },
  {
    destination: 'code/core/spacing.ts',
    tokens: ['spacing', 'dimension'],
  },
  {
    destination: 'code/core/breakpoint.ts',
    tokens: ['sizing'],
  },
];

const semanticTokens = [
  {
    destination: 'code/semantic/zIndex.ts',
    tokens: ['other'],
  },
  {
    destination: 'code/semantic/typography.ts',
    tokens: ['typography'],
  },
];

const sd = StyleDictionary.extend({
  source: ['tokens/**/*.json'],
  platforms: {
    js: {
      transformGroup: 'tokens-studio',
      buildPath: '',
      files: [
        ...coreTokens.map((tokenGroup) => {
          return {
            destination: tokenGroup.destination,
            format: 'javascript/nested',
            filter: (token) => {
              return tokenGroup.tokens.includes(token.type) && token.filePath === 'tokens/core.json';
            },
          };
        }),
        ...semanticTokens.map((tokenGroup) => {
          return {
            destination: tokenGroup.destination,
            format: 'javascript/nested',
            filter: (token) => {
              return tokenGroup.tokens.includes(token.type) && token.filePath === 'tokens/semantic.json';
            },
          };
        }),
        {
          destination: 'code/themes/dark.ts',
          format: 'javascript/nested',
          filter: (token) => {
            return token.filePath === 'tokens/Themes/dark.json';
          },
        },
        {
          destination: 'code/themes/theme.d.ts',
          format: 'typescript/nested',
          filter: (token) => {
            return token.filePath === 'tokens/Themes/dark.json';
          },
        },
        {
          destination: 'code/themes/light.ts',
          format: 'javascript/nested',
          filter: (token) => {
            return token.filePath === 'tokens/Themes/light.json';
          },
        },
      ],
    },
  },
});

sd.cleanAllPlatforms();
sd.buildAllPlatforms();
