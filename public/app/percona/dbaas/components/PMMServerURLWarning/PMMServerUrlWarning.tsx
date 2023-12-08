import { cx } from '@emotion/css';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';

import { Card, useStyles } from '@grafana/ui';

import { Messages } from './PMMServerUrlWarning.messages';
import { getStyles } from './PMMServerUrlWarning.styles';

export const PMMServerUrlWarning: FC<PMMServerUrlWarningProps> = ({ className }) => {
  const styles = useStyles(getStyles);
  return (
    <Card className={cx(styles.alert, className)} data-testid="pmm-server-url-warning">
      <Card.Heading>{Messages.heading}</Card.Heading>
      <Card.Description>
        {Messages.addressSet(window.location.host)}
        {Messages.editLater}
        <Link to="/settings/advanced-settings">{Messages.advancedSettings}</Link>.
      </Card.Description>
    </Card>
  );
};
