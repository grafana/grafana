import { FormChild } from './FormElementTypeEditor';

export const updateAPIPayload = (formElements: FormChild[]) => {
  const submitElement = formElements?.find((child) => {
    if (child.type === 'Submit') {
      return true;
    }
    return false;
  });

  if (!submitElement) {
    return;
  }

  const payload = formElements?.reduce<Record<string, string | number>>((acc, child) => {
    if (child.type !== 'Submit' && child.currentOption) {
      // Ensure currentOption is an array with at least two elements
      const [key, value] = child.currentOption;
      if (typeof key === 'string') {
        acc[key] = value;
      }
    }
    return acc;
  }, {});

  submitElement.api!.data = JSON.stringify(payload);
};
