import { Ref, forwardRef } from 'react';

import { Button, ButtonProps, Icon, Stack } from '@grafana/ui';

import { Trans, t } from '../../../../core/internationalization';

const MoreButton = forwardRef(function MoreButton(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      aria-label={t('alerting.more-button.aria-label', 'More')}
      ref={ref}
      {...props}
    >
      <Stack direction="row" alignItems="center" gap={0}>
        <Trans i18nKey="alerting.more-button.button-text">More</Trans>
        <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});

export default MoreButton;
