import { css } from '@emotion/css';
import { type ReactNode, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Text } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { useStyles2 } from '@grafana/ui/themes';

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
    <div className={styles.collapsableSection}>
      <div className={styles.collapsableSectionHeader}>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => onToggle(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
          <Text color="maxContrast" variant="bodySmall" weight="light">
            {label}
          </Text>
        </button>
        {headerAction}
      </div>
      {isOpen && <div id={contentId}>{children}</div>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  collapsableSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
  }),
  collapsableSectionHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} 0`,
    userSelect: 'none', // Prevent text selection when clicking the button
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
});
