import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';

export const QuerySidebarCollapsableHeader = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);
  const styles = useStyles2(getStyles);

  return (
    <CollapsableSection
      label={
        <Text color="secondary" variant="body">
          {label}
        </Text>
      }
      isOpen={isOpen}
      onToggle={setIsOpen}
      className={styles.collapsableSection}
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
    padding: 0,
    marginTop: theme.spacing(2),
  }),
  queryStackCardsContainer: css({
    paddingTop: theme.spacing(0.5),
  }),
});
