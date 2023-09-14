export const formatTimeHelper = () => {
  return `
  Use this transformation to format the output of a time field. Output can be formatted using (Moment.js format strings)[https://momentjs.com/docs/#/displaying/]. For instance, if you would like to display only the year of a time field the format string 'YYYY' can be used to show the calendar year (e.g. 1999, 2012, etc.).
  
  > **Note:** This transformation is available in Grafana 10.1+ as an alpha feature.
  `;
};
