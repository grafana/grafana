import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useWizardContext } from './wizardContext';

type Props = {
  navigation: React.ComponentType;
};

export function WizardContent(props: Props) {
  const { navigation } = props;
  const { handleSubmit } = useFormContext();
  const { CurrentPageComponent, isLastPage, nextPage, onSubmit } = useWizardContext();

  const NavigationComponent = navigation;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (isLastPage) {
          onSubmit(data);
        } else {
          nextPage();
        }
      })}
    >
      <CurrentPageComponent />
      <NavigationComponent />
    </form>
  );
}
