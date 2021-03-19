import { Field } from '@grafana/ui';
import React, { FC } from 'react';
import { OptionsGroup } from './OptionsGroup';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  children: React.ReactElement;
}

export const OptionsPaneItem: FC<OptionsPaneItemProps> = ({ children, title, description }) => (
  <Field label={title} description={description}>
    {children}
  </Field>
);
OptionsPaneItem.displayName = 'OptionsPaneItem';

export interface OptionsPaneCategoryProps {
  title: string;
  children: React.ReactElement | React.ReactElement[];
}

export const OptionsPaneCategory: FC<OptionsPaneCategoryProps> = ({ children, title }) => (
  <OptionsGroup id={title} title={title}>
    {children}
  </OptionsGroup>
);
OptionsPaneCategory.displayName = 'OptionsPaneCategory';
