export const resourceValidator = (value: number) => {
  if (!value || Math.floor(value) === value) {
    return undefined;
  }

  const precision = value.toString().split('.')[1]?.length || 0;

  return precision > 1 ? 'Only one decimal place allowed' : undefined;
};
