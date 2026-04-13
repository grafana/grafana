import { css } from '@emotion/css';
import { type ReactNode, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

interface CollapsableSectionProps {
  label: string;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

export const CollapsableSection = ({ label, isOpen, onToggle, headerAction, children }: CollapsableSectionProps) => {
  const styles = useStyles2(getStyles);
  const contentId = useId();

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => onToggle(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} className={styles.icon} />
          <Text color="maxContrast" variant="bodySmall" weight="light">
            {label}
          </Text>
        </button>
        {headerAction}
      </div>
      {isOpen && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </section>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    paddingTop: theme.spacing(1),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} 0`,
    userSelect: 'none',
  }),
  toggleButton: css({
    all: 'unset',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    borderRadius: theme.shape.radius.sm,
    '&:focus-visible': getFocusStyles(theme),
  }),
  icon: css({
    color: theme.colors.text.secondary,
  }),
  content: css({
    paddingTop: theme.spacing(1),
  }),
});
