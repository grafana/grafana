import React from 'react';

import { Icon, Input } from '@grafana/ui';

import { HoverCard } from '../HoverCard';

import { PromDurationDocs } from './PromDurationDocs';

export const PromDurationInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  (props, ref) => {
    return (
      <Input
        suffix={
          <HoverCard content={<PromDurationDocs />} disabled={false}>
            <Icon name="info-circle" size="lg" />
          </HoverCard>
        }
        {...props}
        ref={ref}
      />
    );
  }
);

PromDurationInput.displayName = 'PromDurationInput';
