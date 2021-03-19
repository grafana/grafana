import { Field } from '@grafana/ui';
import React, { FC } from 'react';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  children: React.ReactElement;
  skipLabel?: boolean;
}

export const OptionsPaneItem: FC<OptionsPaneItemProps> = ({ children, title, description }) => {
  return (
    <Field label={title} description={description}>
      {children}
    </Field>
  );
};

OptionsPaneItem.displayName = 'OptionsPaneItem';
