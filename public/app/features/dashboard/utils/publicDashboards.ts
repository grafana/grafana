export const isDashboardPubliclyViewed = () => {
  return window.location.pathname.split('/')[1] === 'p';
};
