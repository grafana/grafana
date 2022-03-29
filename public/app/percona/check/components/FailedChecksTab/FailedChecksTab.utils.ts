export const stripServiceId = (serviceId: string) => {
  const regex = /\/service_id\/(.*)/gm;
  const match = regex.exec(serviceId);

  if (match && match.length > 0) {
    return match[1] || '';
  }

  return '';
};

export const formatServiceId = (serviceId: string) => `/service_id/${serviceId}`;
