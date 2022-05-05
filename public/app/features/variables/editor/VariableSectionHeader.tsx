import { css } from '@emotion/css';
import React, { PropsWithChildren, ReactElement } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

interface VariableSectionHeaderProps {
  name: string;
}

export function VariableSectionHeader({ name }: PropsWithChildren<VariableSectionHeaderProps>): ReactElement {
  const styles = useStyles(getStyles);

  return <h5 className={styles.sectionHeading}>{name}</h5>;
}

function getStyles(theme: GrafanaTheme) {
  return {
    sectionHeading: css`
      label: sectionHeading;
      font-size: ${theme.typography.size.md};
      margin-bottom: ${theme.spacing.sm};
    `,
  };
}
