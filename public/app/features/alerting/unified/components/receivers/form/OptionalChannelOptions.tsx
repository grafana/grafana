import React from 'react';
import { CollapsableSection, InfoBox } from '@grafana/ui';
import { ChannelOptions, Props as ChannelOptionsProps } from './ChannelOptions';
import { ChannelValues } from '../../../types/receiver-form';
import { NotifierDTO } from 'app/types';

interface Props<R extends ChannelValues> extends ChannelOptionsProps<R> {
  notifier: NotifierDTO;
}

export function OptionalChannelOptions<R extends ChannelValues>({ notifier, ...props }: Props<R>): JSX.Element {
  return (
    <CollapsableSection label={`Optional ${notifier.heading}`} isOpen={false}>
      {notifier.info !== '' && <InfoBox>{notifier.info}</InfoBox>}
      <ChannelOptions<R> {...props} />
    </CollapsableSection>
  );
}
