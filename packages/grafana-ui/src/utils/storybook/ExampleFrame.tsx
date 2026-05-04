import { css, cx } from '@emotion/css';
import { Source } from '@storybook/addon-docs/blocks';
import { Children, isValidElement, type ReactNode, useMemo, useState } from 'react';
import reactElementToJSXString from 'react-element-to-jsx-string';

import { type GrafanaTheme2 } from '@grafana/data';

import { Stack } from '../../components/Layout/Stack/Stack';
import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

interface ExampleFrameProps {
  children: ReactNode;
}

/**
 * Wraps children with a border for nicer presentation in Storybook docs.
 * Includes a collapsible code block that shows the JSX source of the children.
 */
export function ExampleFrame(props: ExampleFrameProps) {
  const { children } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(false);

  const sourceString = useMemo(() => {
    const opts = { sortProps: false };
    return Children.toArray(children)
      .filter(isValidElement)
      .map((child) => reactElementToJSXString(child, opts))
      .join('\n');
  }, [children]);

  return (
    <div className={cx(styles.wrapper, 'sb-unstyled')}>
      <Stack gap={0} direction="column">
        <div className={styles.preview}>{children}</div>
        {isExpanded && (
          <div className={styles.source}>
            <Source dark={theme.isDark} code={sourceString} language="tsx" />
          </div>
        )}
        <button className={styles.toggle} onClick={() => setIsExpanded(!isExpanded)}>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          {isExpanded ? 'Hide code' : 'Show code'}
        </button>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(2, 0),
      overflow: 'hidden',
    }),
    preview: css({
      padding: theme.spacing(2),
    }),
    source: css({
      borderTop: `1px solid ${theme.colors.border.medium}`,
      // Reset Storybook Source margins/border-radius so it sits flush
      '& .docblock-source': {
        border: 'none',
        borderRadius: 'unset',
        margin: 0,

        '& pre': {
          border: 'none',
        },
      },
    }),
    toggle: css({
      background: 'none',
      border: 'unset',
      borderTop: `1px solid ${theme.colors.border.medium}`,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
    }),
  };
};
