import { Ref, forwardRef } from 'react';

import { Button, ButtonProps, Icon, Stack } from '@grafana/ui';

const MoreButton = forwardRef(function MoreButton(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  return (
    <Button variant="secondary" size="sm" type="button" aria-label="More" ref={ref} {...props}>
      <Stack direction="row" alignItems="center" gap={0}>
        More <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});

export default MoreButton;
