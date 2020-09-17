import { FC } from 'react';
import { useFormContext, FormContextValues } from 'react-hook-form';

export interface Props {
  children: (formMethods: FormContextValues) => JSX.Element;
}

export const FormContextConsumer: FC<Props> = ({ children }) => {
  const formMethods = useFormContext();
  return children({ ...formMethods });
};
