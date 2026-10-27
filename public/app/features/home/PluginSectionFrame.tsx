import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { HomeSection } from './HomeSection';

interface Props {
  children: ReactNode;
  'data-testid'?: string;
}

/** Frames plugin-rendered content as a section, hidden while the plugin renders nothing, so no empty card is left behind. */
export function PluginSectionFrame({ children, 'data-testid': testId }: Props) {
  return (
    <div className={styles.frame}>
      <HomeSection data-testid={testId}>{children}</HomeSection>
    </div>
  );
}

const styles = {
  frame: css({
    display: 'contents',

    '> div': {
      '&:empty': {
        display: 'none',
      },
    },
  }),
};
