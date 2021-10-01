import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DescriptionBlockProps } from './DescriptionBlock.types';
import { Messages } from './DescriptionBlock.messages';
import { getStyles } from './DescriptionBlock.styles';

export const DescriptionBlock: FC<DescriptionBlockProps> = ({ description, dataTestId }) => {
  const styles = useStyles(getStyles);

  return (
    <div data-testid={dataTestId} className={styles.descriptionWrapper}>
      <span>{Messages.description}</span>
      <pre>{description}</pre>
    </div>
  );
};
