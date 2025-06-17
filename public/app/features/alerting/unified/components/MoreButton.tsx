import { Ref, forwardRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ButtonProps, Icon, Stack } from '@grafana/ui';

const MoreButton = forwardRef(function MoreButton(
  props: ButtonProps & { title?: string },
  ref: Ref<HTMLButtonElement>
) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      aria-label={props.title ?? t('alerting.more-button.aria-label', 'More')}
      ref={ref}
      {...props}
    >
      <Stack direction="row" alignItems="center" gap={0}>
        {props.title ?? <Trans i18nKey="alerting.more-button.button-text">More</Trans>}
        <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});

export default MoreButton;
