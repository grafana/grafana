import { RuleTester } from 'eslint';

import preferUseStyles2 from '../rules/prefer-use-styles2.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const error = {
  messageId: 'preferUseStyles2',
};

const ruleTester = new RuleTester();

ruleTester.run('eslint prefer-use-styles2', preferUseStyles2, {
  valid: [
    // The memoized path: theme comes from useStyles2, not useTheme2.
    {
      name: 'styles obtained via useStyles2',
      code: `
        function Comp() {
          const styles = useStyles2(getStyles);
          return null;
        }
      `,
    },
    {
      name: 'useStyles2 with extra primitive args',
      code: `
        function Comp({ size }) {
          const styles = useStyles2(getButtonStyles, size);
          return null;
        }
      `,
    },
    // A style creator that receives its own `theme` parameter (not a useTheme2 binding) is fine.
    {
      name: 'style creator calling another creator with its theme param',
      code: `
        function getButtonStylesForPrimitives(theme, size) {
          return getButtonStyles({ theme, size });
        }
      `,
    },
    // Legitimate useTheme2 usage: theme feeds inline token access / non-style helpers, not a style creator.
    {
      name: 'theme used for inline token access',
      code: `
        function Comp() {
          const theme = useTheme2();
          const gap = theme.spacing(1);
          return null;
        }
      `,
    },
    {
      name: 'theme passed to a non-style helper',
      code: `
        function Comp() {
          const theme = useTheme2();
          const color = getColorForTheme(theme);
          return null;
        }
      `,
    },
    // Global stylesheets: creators feed <Global styles={[...]}>, not per-render classes.
    {
      name: 'style creators passed to <Global styles={[...]}>',
      code: `
        function GlobalStyles() {
          const theme = useTheme2();
          return <Global styles={[getPageStyles(theme), getFontStyles(theme)]} />;
        }
      `,
    },
  ],

  invalid: [
    // Object-arg shape: getStyles({ theme, ... })
    {
      name: 'getButtonStyles called with an object literal containing the theme',
      code: `
        function Button({ size }) {
          const theme = useTheme2();
          const styles = getButtonStyles({ theme, size });
          return null;
        }
      `,
      errors: [error],
    },
    // Positional shape: getStyles(theme, ...)
    {
      name: 'getStyles called positionally with the theme',
      code: `
        function Comp() {
          const theme = useTheme2();
          const styles = getStyles(theme);
          return null;
        }
      `,
      errors: [error],
    },
    // Renamed theme binding is still tracked.
    {
      name: 'renamed useTheme2 binding',
      code: `
        function Comp() {
          const t = useTheme2();
          const styles = getPanelStyles({ theme: t });
          return null;
        }
      `,
      errors: [error],
    },
    // Nested inside cx().
    {
      name: 'style creator call nested in cx',
      code: `
        function Comp() {
          const theme = useTheme2();
          const cls = cx(getStyles(theme), 'extra');
          return null;
        }
      `,
      errors: [error],
    },
  ],
});
