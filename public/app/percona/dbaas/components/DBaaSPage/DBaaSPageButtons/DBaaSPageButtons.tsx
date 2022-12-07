import { LoaderButton } from '@percona/platform-core';
import React, { FC } from 'react';

import { LinkButton, useStyles } from '@grafana/ui/src';

import { Messages } from './DBaaSPageButtons.messages';
import { getStyles } from './DBaaSPageButtons.styles';
import { DBaaSPageButtonsProps } from './DBaaSPageButtons.types';

export const DBaaSPageButtons: FC<DBaaSPageButtonsProps> = ({ pageName, cancelUrl, submitBtnProps }) => {
  const { buttonMessage, ...props } = submitBtnProps;
  const styles = useStyles(getStyles);
  return (
    <div className={styles.buttonsWrapper}>
      <LinkButton href={cancelUrl} data-testid={`${pageName}-cancel-button`} variant="secondary" fill="outline">
        {Messages.cancelButton}
      </LinkButton>
      <LoaderButton data-testid={`${pageName}-submit-button`} size="md" type="submit" variant="primary" {...props}>
        {buttonMessage ? buttonMessage : Messages.confirmButton}
      </LoaderButton>
    </div>
  );
};

export default DBaaSPageButtons;
