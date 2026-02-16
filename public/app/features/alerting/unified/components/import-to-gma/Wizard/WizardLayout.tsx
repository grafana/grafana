import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Stepper } from './Stepper';

interface WizardLayoutProps {
  children: ReactNode;
}

/**
 * WizardLayout - provides the main layout structure for the wizard
 * with a sidebar (Stepper) and main content area
 */
export const WizardLayout = ({ children }: WizardLayoutProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <Stepper />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(4),
    minHeight: '600px',
  }),
  sidebar: css({
    flexShrink: 0,
    paddingTop: theme.spacing(1),
  }),
  content: css({
    flex: 1,
    maxWidth: '800px',
  }),
});
