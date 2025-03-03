import { forwardRef } from 'react';

import { Icon, Input } from '@grafana/ui';

import { PopupCard } from '../HoverCard';

import { PromDurationDocs } from './PromDurationDocs';

export const PromDurationInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>((props, ref) => {
  return (
    <Input
      suffix={
        <PopupCard content={<PromDurationDocs />} disabled={false}>
          <Icon name="info-circle" size="lg" />
        </PopupCard>
      }
      {...props}
      ref={ref}
    />
  );
});

PromDurationInput.displayName = 'PromDurationInput';
