import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';

interface QuerySidebarCollapsableHeaderProps {
  label: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const QuerySidebarCollapsableHeader = ({
  label,
  children,
  headerAction,
}: QuerySidebarCollapsableHeaderProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const styles = useStyles2(getStyles);

  return (
    <CollapsableSection
      label={
        <Stack direction="row" alignItems="center" gap={0.5}>
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
      onToggle={setIsOpen}
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
    marginTop: theme.spacing(1),
  }),
  contentArea: css({
    padding: 0,
  }),
  queryStackCardsContainer: css({
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(2.5), // Prevents clipping of the last card's absolutely-positioned AddCardButton
  }),
});
