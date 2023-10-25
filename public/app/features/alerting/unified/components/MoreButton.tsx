import React, { forwardRef, Ref } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, ButtonProps, Icon } from '@grafana/ui';

const MoreButton = forwardRef(function MoreButton(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      aria-label="more-actions"
      data-testid="more-actions"
      ref={ref}
      {...props}
    >
      <Stack direction="row" alignItems="center" gap={0}>
        More <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});

export default MoreButton;
