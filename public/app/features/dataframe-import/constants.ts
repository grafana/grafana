import { Accept } from 'react-dropzone';

export const acceptedFiles: Accept = {
  'text/plain': ['.csv', '.txt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.apple.numbers': ['.numbers'],
  'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
  'application/json': ['.json'],
};

//This should probably set from grafana conf
export const maxFileSize = 1000000;
