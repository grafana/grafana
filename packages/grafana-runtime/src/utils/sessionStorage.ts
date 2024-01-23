export const getReturnToPrevious = () => {
  return {
    title: sessionStorage.getItem('returnToPreviousTitle') || '',
    href: sessionStorage.getItem('returnToPreviousHref') || '',
  };
};

export const setReturnToPrevious = ({ title, href }: { title: string; href: string }) => {
  sessionStorage.setItem('returnToPreviousTitle', title);
  sessionStorage.setItem('returnToPreviousHref', href);
};
