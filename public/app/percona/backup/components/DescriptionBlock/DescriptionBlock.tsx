import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { Messages } from './DescriptionBlock.messages';
import { getStyles } from './DescriptionBlock.styles';
import { DescriptionBlockProps } from './DescriptionBlock.types';

export const DescriptionBlock: FC<React.PropsWithChildren<DescriptionBlockProps>> = ({ description, dataTestId }) => {
  const styles = useStyles(getStyles);

  return (
    <div data-testid={dataTestId} className={styles.descriptionWrapper}>
      <span>{Messages.description}</span>
      <pre>{description}</pre>
    </div>
  );
};
