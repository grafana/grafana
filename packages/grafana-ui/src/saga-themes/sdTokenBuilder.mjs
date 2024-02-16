import { registerTransforms } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';

registerTransforms(StyleDictionary);

const { minifyDictionary } = StyleDictionary.formatHelpers;
StyleDictionary.registerFormat({
  name: 'javascript/nested',
  formatter: function (dictionary) {
    return `export default ${JSON.stringify(minifyDictionary(dictionary.tokens), null, 2)};`;
  },
});

const coreTokens = [
  {
    destination: 'code/core/color.js',
    tokens: ['color'],
  },
  {
    destination: 'code/core/border.js',
    tokens: ['borderWidth', 'borderRadius'],
  },
  {
    destination: 'code/core/opacity.js',
    tokens: ['opacity'],
  },
  {
    destination: 'code/core/zIndex.js',
    tokens: ['other'],
  },
  {
    destination: 'code/core/typography.js',
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
    destination: 'code/core/spacing.js',
    tokens: ['spacing', 'dimension'],
  },
  {
    destination: 'code/core/breakpoint.js',
    tokens: ['sizing'],
  },
];

const semanticTokens = [
  {
    destination: 'code/semantic/zIndex.js',
    tokens: ['other'],
  },
  {
    destination: 'code/semantic/typography.js',
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
          destination: 'code/themes/dark.js',
          format: 'javascript/nested',
          filter: (token) => {
            return token.filePath === 'tokens/Theming/dark.json';
          },
        },
        {
          destination: 'code/themes/light.js',
          format: 'javascript/nested',
          filter: (token) => {
            return token.filePath === 'tokens/Theming/light.json';
          },
        },
      ],
    },
  },
});

sd.cleanAllPlatforms();
sd.buildAllPlatforms();
