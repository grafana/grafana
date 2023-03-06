import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ValuePicker, useStyles2 } from '@grafana/ui';
import { UserOrg } from 'app/types';

import { OrganizationBaseProps } from './types';

export function OrganizationPicker({ orgs, onSelectChange }: OrganizationBaseProps) {
  const styles = useStyles2(getStyles);
  return (
    <ValuePicker<UserOrg>
      aria-label="Change organization"
      variant="secondary"
      buttonCss={styles.buttonCss}
      size="md"
      label=""
      fill="text"
      isFullWidth={false}
      options={orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      }))}
      onChange={onSelectChange}
      icon="building"
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonCss: css({
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});
