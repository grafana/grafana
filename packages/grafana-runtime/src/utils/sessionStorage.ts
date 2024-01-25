export const getReturnToPrevious = () => {
  const returnToPrevious = sessionStorage.getItem('returnToPrevious');
  return returnToPrevious ? JSON.parse(returnToPrevious) : returnToPrevious;
};

export const setReturnToPrevious = ({ title, href }: { title: string; href: string }) => {
  const returnToPrevious = JSON.stringify({ title, href });
  sessionStorage.setItem('returnToPrevious', returnToPrevious);
};

export const clearReturnToPrevious = () => {
  sessionStorage.removeItem('returnToPrevious');
};
