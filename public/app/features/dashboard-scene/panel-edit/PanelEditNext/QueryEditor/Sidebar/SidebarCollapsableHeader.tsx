import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';

interface SidebarCollapsableHeaderProps {
  label: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

export const SidebarCollapsableHeader = ({
  label,
  children,
  headerAction,
  isOpen,
  onToggle,
}: SidebarCollapsableHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <CollapsableSection
      label={
        <div className={styles.headerContent}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Text color="maxContrast" variant="bodySmall" weight="light">
              {label}
            </Text>
            {headerAction && (
              <div
                className={styles.headerActionWrapper}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="button"
                tabIndex={0}
              >
                {headerAction}
              </div>
            )}
          </Stack>
        </div>
      }
      isOpen={isOpen}
      onToggle={onToggle}
      className={styles.collapsableSection}
      contentClassName={styles.contentArea}
    >
      <div className={styles.queryStackCardsContainer}>{children}</div>
    </CollapsableSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  collapsableSection: css({
    marginTop: theme.spacing(0.5),
  }),
  contentArea: css({
    padding: 0,
  }),
  queryStackCardsContainer: css({
    paddingTop: theme.spacing(1),
  }),
  headerActionWrapper: css({
    // This is used so we can stop the header action from triggering the collapse of the header
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-start',
  }),
  headerContent: css({
    width: '100%',
  }),
});
