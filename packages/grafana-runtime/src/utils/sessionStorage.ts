export const getReturnToPrevious = () => {
  return {
    title: window.sessionStorage['returnToPreviousTitle'],
    href: window.sessionStorage['returnToPreviousHref'],
  };
};

export const setReturnToPrevious = ({ title, href }: { title: string; href: string }) => {
  sessionStorage.setItem('returnToPreviousTitle', title);
  sessionStorage.setItem('returnToPreviousHref', href);
};
