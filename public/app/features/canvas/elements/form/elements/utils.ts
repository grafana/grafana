import { FormChild } from './FormElementTypeEditor';

export const updateAPIPayload = (formElements: FormChild[], scene: any) => {
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
      child.currentOption.forEach((option) => {
        for (const key in option) {
          const value = option[key];
          acc[key] = value;
        }
      });
    }
    return acc;
  }, {});

  submitElement.api!.data = JSON.stringify(payload);
  // need so the FormElementTypeEditor rerenders and payload
  scene.moved.next(Date.now());
};
