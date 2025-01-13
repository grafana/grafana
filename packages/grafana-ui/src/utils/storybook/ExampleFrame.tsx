import { css } from '@emotion/css';
import { Unstyled } from '@storybook/blocks';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface ExampleFrameProps {
  children: ReactNode;
}

/**
 * Wraps children with a border for nicer presentation in Storybook docs.
 *
 * This is intended to be used temporarily to move away from our <Preview> patch until
 * we have something more long term.
 */
export function ExampleFrame(props: ExampleFrameProps) {
  const { children } = props;
  const styles = useStyles2(getStyles);

  return (
    <Unstyled>
      <div className={styles.container}>{children}</div>
    </Unstyled>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(4),
    }),
  };
};
