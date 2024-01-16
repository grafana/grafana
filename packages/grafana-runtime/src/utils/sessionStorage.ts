export const getReturnToPrevious = () => {
  return {
    title: window.sessionStorage['returnToPreviousTitle'],
    href: window.sessionStorage['returnToPreviousHref'],
  };
};

export const setReturnToPrevious = ({ title, href }: { title: string; href: string }) => {
  window.sessionStorage['returnToPreviousTitle'] = title;
  window.sessionStorage['returnToPreviousHref'] = href;
};
