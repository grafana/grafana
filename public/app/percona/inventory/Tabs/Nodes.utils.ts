export const getServiceLink = (serviceId: string) => {
  return `/inventory/services?search-text-input=${serviceId}&search-select=serviceId`;
};
