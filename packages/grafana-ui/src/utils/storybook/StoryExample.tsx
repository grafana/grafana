import { css } from '@emotion/css';
import * as React from 'react';

import { Stack } from '../../components/Layout/Stack/Stack';
import { Text } from '../../components/Text/Text';

export interface Props {
  name: string;
  children?: React.ReactNode;
}

export const StoryExample = ({ name, children }: Props) => {
  const style = css({
    width: '100%',
    padding: '16px',
  });

  return (
    <div className={style}>
      <Stack gap={2} direction="column">
        <Text variant="h5">{name}</Text>
        {children}
      </Stack>
    </div>
  );
};

StoryExample.displayName = 'StoryExample';
