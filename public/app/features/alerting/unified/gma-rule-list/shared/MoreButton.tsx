import { type Ref, forwardRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, type ButtonProps, Icon, Stack } from '@grafana/ui';

type MoreButtonProps = Omit<ButtonProps, 'children' | 'variant'>;

export const MoreButton = forwardRef(function MoreButton(props: MoreButtonProps, ref: Ref<HTMLButtonElement>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      aria-label={t('alerting.gma-rule-list.shared.more-button-aria-label', 'More')}
      ref={ref}
      {...props}
    >
      <Stack direction="row" alignItems="center" gap={0}>
        <Trans i18nKey="alerting.gma-rule-list.shared.more-button-text">More</Trans>
        <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});
