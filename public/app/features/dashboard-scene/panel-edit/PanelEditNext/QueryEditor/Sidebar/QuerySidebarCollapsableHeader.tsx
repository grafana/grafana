import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';

interface QuerySidebarCollapsableHeaderProps {
  label: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

export const QuerySidebarCollapsableHeader = ({
  label,
  children,
  headerAction,
  isOpen,
  onToggle,
}: QuerySidebarCollapsableHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <CollapsableSection
      label={
        <Stack direction="row" alignItems="center" gap={1}>
          <Text color="maxContrast" variant="bodySmall" weight="light">
            {label}
          </Text>
          {headerAction && (
            // `stopPropagation` to prevent the header action from triggering the collapsable section collapse
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="button" tabIndex={0}>
              {headerAction}
            </div>
          )}
        </Stack>
      }
      isOpen={isOpen}
      onToggle={onToggle}
      className={styles.collapsableSection}
      contentClassName={styles.contentArea}
    >
      <div className={styles.queryStackCardsContainer}>
        <Stack direction="column" gap={2.5}>
          {children}
        </Stack>
      </div>
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
});
