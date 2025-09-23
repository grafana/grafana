export const capitalizeText = (text: string) => {
  if (!text.length) {
    return '';
  }

  if (text.length === 1) {
    return text.toUpperCase();
  }

  return `${text[0].toUpperCase()}${text.substring(1).toLowerCase()}`;
};
