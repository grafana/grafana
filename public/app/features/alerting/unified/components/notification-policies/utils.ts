import { ControllerRenderProps } from 'react-hook-form';

export const handleContactPointSelect = (
  name: string | undefined | null,
  onChange: ControllerRenderProps['onChange']
) => {
  if (name === null) {
    return onChange(null);
  }

  if (!name) {
    return onChange('');
  }

  return onChange(name);
};
